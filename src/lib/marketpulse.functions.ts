import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildInsight, rankInsights } from "@/lib/market/engine";
import {
  NIFTY,
  SENSEX,
  UNIVERSE_MAP,
  normalizeSymbol,
  searchUniverse,
} from "@/lib/market/universe";
import type { IndexQuote, MarketStatus, Quote, Snapshot, StockInsight } from "@/lib/market/types";

export interface DashboardPayload {
  watchlistId: string;
  watchlistName: string;
  status: MarketStatus;
  indices: IndexQuote[];
  insights: StockInsight[];
  changes: StockInsight[];
  lastCheckedAt: string | null;
  isFirstVisit: boolean;
  dataSource: "demo" | "live";
  fetchedAt: string;
  recentHistory: ChangeHistoryItem[];
  summary: {
    meaningfulChanges: number;
    biggestMover: { symbol: string; name: string; changePct: number } | null;
    bestPerformer: { symbol: string; name: string; changePct: number } | null;
    marketMove: string;
    needsAttention: string[];
  };
  watchlistPerformance: {
    avgChangePct: number;
    outperformingCount: number;
    underperformingCount: number;
    niftyChangePct: number;
    interpretation: string;
  } | null;
  displayName: string | null;
}

export interface ChangeHistoryItem {
  id: string;
  symbol: string;
  level: StockInsight["level"];
  attentionScore: number;
  price: number;
  changePct: number;
  sinceCheckPct: number | null;
  relativeToNifty: number;
  volumeRatio: number;
  headline: string;
  why: string;
  capturedAt: string;
  signals: Array<{ kind: string; label: string; detail: string; tone: string }>;
}

export interface ChangeHistoryPayload {
  items: ChangeHistoryItem[];
}

const symbolSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, "Symbol is required")
    .max(20)
    .transform((s) => s.toUpperCase()),
});

async function loadWatchlist(supabase: any, userId: string) {
  const { data: existing, error } = await supabase
    .from("watchlists")
    .select("id, name")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existing) return existing as { id: string; name: string };

  const { data: created, error: createError } = await supabase
    .from("watchlists")
    .insert({ user_id: userId, name: "My Watchlist" })
    .select("id, name")
    .single();
  if (createError) throw new Error(createError.message);

  const seed = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "ITC"];
  await supabase
    .from("watchlist_stocks")
    .insert(seed.map((symbol) => ({ watchlist_id: created.id, user_id: userId, symbol })));
  return created as { id: string; name: string };
}

function toHistoryItem(row: any): ChangeHistoryItem {
  return {
    id: row.id,
    symbol: row.symbol,
    level: row.level,
    attentionScore: Number(row.attention_score),
    price: Number(row.price),
    changePct: Number(row.change_pct),
    sinceCheckPct: row.since_check_pct === null ? null : Number(row.since_check_pct),
    relativeToNifty: Number(row.relative_to_nifty),
    volumeRatio: Number(row.volume_ratio),
    headline: row.headline,
    why: row.why,
    capturedAt: row.captured_at,
    signals: Array.isArray(row.signals) ? row.signals : [],
  };
}

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardPayload> => {
    const { supabase, userId } = context;
    const { getMarketProvider, getMarketStatus, toIndexQuote } =
      await import("@/lib/market/provider.server");

    const watchlist = await loadWatchlist(supabase, userId);

    const [{ data: rows }, { data: snapRows }, { data: checkpointRow }, { data: historyRows }, { data: profileRow }] =
      await Promise.all([
        supabase
          .from("watchlist_stocks")
          .select("symbol, added_at")
          .eq("watchlist_id", watchlist.id)
          .order("added_at", { ascending: true }),
        supabase
          .from("market_snapshots")
          .select("symbol, price, volume, captured_at")
          .eq("user_id", userId),
        supabase
          .from("checkpoints")
          .select("last_checked_at, previous_checked_at")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("change_history")
          .select(
            "id, symbol, level, attention_score, price, change_pct, since_check_pct, relative_to_nifty, volume_ratio, headline, why, captured_at",
          )
          .eq("user_id", userId)
          .order("captured_at", { ascending: false })
          .limit(8),
        supabase
          .from("profiles")
          .select("display_name")
          .eq("id", userId)
          .maybeSingle(),
      ]);

    const symbols = (rows ?? []).map((r: { symbol: string }) => r.symbol);
    const provider = getMarketProvider();
    const quotes = await provider.getQuotes([...symbols, NIFTY, SENSEX]);
    const bySymbol = new Map<string, Quote>(quotes.map((q) => [q.symbol, q]));

    const nifty = bySymbol.get(NIFTY);
    const sensex = bySymbol.get(SENSEX);
    const niftyChangePct = nifty?.changePct ?? 0;

    const snapshots = new Map<string, Snapshot>(
      (snapRows ?? []).map((s: any) => [
        s.symbol,
        {
          symbol: s.symbol,
          price: Number(s.price),
          volume: Number(s.volume),
          capturedAt: s.captured_at,
        },
      ]),
    );

    // ── Demo baseline seeding ─────────────────────────────────────────────────
    // On a brand-new demo session (no checkpoint row, no snapshots) synthesise a
    // baseline as if the user had last visited 4 h 32 m ago.  Offset prices are
    // chosen so that buildInsight immediately surfaces SIGNIFICANT / NOTABLE
    // "since last check" signals through the existing engine.  Live mode is
    // completely unaffected — the guard checks provider.id === "demo".
    let checkpoint = checkpointRow;
    if (!checkpoint && provider.id === "demo" && symbols.length > 0) {
      const DEMO_GAP_MS = (4 * 60 + 32) * 60 * 1_000; // 4 h 32 m in ms
      const demoTime = new Date(Date.now() - DEMO_GAP_MS).toISOString();

      // Seed price offsets: index 0 → −3.5%, index 1 → +2.2%, index 2 → −1.2%
      // Negative offset  →  current price is higher  →  positive sinceCheckPct
      // Positive offset  →  current price is lower   →  negative sinceCheckPct
      const SEED_OFFSETS = [-0.035, 0.022, -0.012];

      const demoSnaps = symbols
        .map((symbol, idx) => {
          const q = bySymbol.get(symbol);
          if (!q) return null;
          const factor = 1 + (SEED_OFFSETS[idx] ?? 0);
          return {
            user_id: userId,
            symbol,
            price: q.price * factor,
            volume: q.volume,
            captured_at: demoTime,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);

      // Persist seeded snapshots and checkpoint concurrently; swallow errors so
      // the dashboard still renders even if a write races or fails.
      await Promise.all([
        supabase.from("market_snapshots").upsert(demoSnaps, { onConflict: "user_id,symbol" }),
        supabase
          .from("checkpoints")
          .upsert(
            { user_id: userId, last_checked_at: demoTime, previous_checked_at: null },
            { onConflict: "user_id" },
          ),
      ]);

      // Rebuild snapshots Map so buildInsight sees the seeded baselines
      for (const snap of demoSnaps) {
        snapshots.set(snap.symbol, {
          symbol: snap.symbol,
          price: snap.price,
          volume: snap.volume,
          capturedAt: demoTime,
        });
      }

      // Treat this request as a return visit
      checkpoint = { last_checked_at: demoTime, previous_checked_at: null };
    }
    // ── End demo seeding ──────────────────────────────────────────────────────

    const insights = symbols
      .map((symbol) => bySymbol.get(symbol))
      .filter((q): q is Quote => Boolean(q))
      .map((quote) =>
        buildInsight({ quote, snapshot: snapshots.get(quote.symbol), niftyChangePct }),
      );

    const ranked = rankInsights(insights);
    const changes = ranked.filter((i) => i.level !== "NORMAL" || i.signals.length > 0);

    const byAbsMove = [...insights].sort(
      (a, b) => Math.abs(b.quote.changePct) - Math.abs(a.quote.changePct),
    );
    const byBest = [...insights].sort((a, b) => b.quote.changePct - a.quote.changePct);

    // Calculate watchlist performance (equal-weighted average)
    let watchlistPerformance: DashboardPayload["watchlistPerformance"] = null;
    if (insights.length > 0 && nifty) {
      const avgChangePct =
        insights.reduce((sum, i) => sum + i.quote.changePct, 0) / insights.length;
      const outperformingCount = insights.filter((i) => i.quote.changePct > niftyChangePct).length;
      const underperformingCount = insights.filter(
        (i) => i.quote.changePct < niftyChangePct,
      ).length;
      const diff = avgChangePct - niftyChangePct;

      let interpretation: string;
      if (Math.abs(diff) < 0.3) {
        interpretation = "Your watchlist is broadly moving with the market";
      } else if (diff > 0) {
        interpretation = `Your watchlist is outperforming NIFTY by ${diff.toFixed(2)}% today`;
      } else {
        interpretation = `Your watchlist is underperforming the market by ${Math.abs(diff).toFixed(2)}%`;
      }

      watchlistPerformance = {
        avgChangePct,
        outperformingCount,
        underperformingCount,
        niftyChangePct,
        interpretation,
      };
    }

    return {
      watchlistId: watchlist.id,
      watchlistName: watchlist.name,
      status: getMarketStatus(),
      indices: [nifty, sensex].filter(Boolean).map((q) => toIndexQuote(q as Quote)),
      insights: ranked,
      changes,
      lastCheckedAt: checkpoint?.last_checked_at ?? null,
      isFirstVisit: !checkpoint,
      dataSource: provider.id,
      fetchedAt: new Date().toISOString(),
      recentHistory: (historyRows ?? []).map(toHistoryItem),
      summary: {
        meaningfulChanges: changes.length,
        biggestMover: byAbsMove[0]
          ? {
              symbol: byAbsMove[0].quote.symbol,
              name: byAbsMove[0].quote.name,
              changePct: byAbsMove[0].quote.changePct,
            }
          : null,
        bestPerformer: byBest[0]
          ? {
              symbol: byBest[0].quote.symbol,
              name: byBest[0].quote.name,
              changePct: byBest[0].quote.changePct,
            }
          : null,
        marketMove: nifty
          ? `NIFTY 50 ${nifty.changePct >= 0 ? "up" : "down"} ${Math.abs(nifty.changePct).toFixed(2)}%`
          : "Index data unavailable",
        needsAttention: changes
          .filter((c) => c.level === "SIGNIFICANT" || c.level === "CRITICAL")
          .map((c) => c.quote.symbol),
      },
      watchlistPerformance,
      displayName: profileRow?.display_name ?? null,
    };
  });

export const addStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => symbolSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const cleanSymbol = normalizeSymbol(data.symbol);
    if (
      cleanSymbol === NIFTY ||
      cleanSymbol === SENSEX ||
      cleanSymbol === "NIFTY" ||
      cleanSymbol === "SENSEX"
    ) {
      throw new Error("Market indices cannot be added to your stock watchlist");
    }

    const watchlist = await loadWatchlist(supabase, userId);
    const { data: existing } = await supabase
      .from("watchlist_stocks")
      .select("id")
      .eq("watchlist_id", watchlist.id)
      .eq("symbol", cleanSymbol)
      .maybeSingle();
    if (existing) throw new Error(`${cleanSymbol} is already in your watchlist`);

    const { getMarketProvider } = await import("@/lib/market/provider.server");
    const provider = getMarketProvider();
    const quotes = await provider.getQuotes([cleanSymbol]);
    if (!quotes.length || !quotes[0]) {
      throw new Error(`Could not resolve market data for ${cleanSymbol}`);
    }

    const { error } = await supabase
      .from("watchlist_stocks")
      .insert({ watchlist_id: watchlist.id, user_id: userId, symbol: cleanSymbol });
    if (error) throw new Error(error.message);
    return { ok: true, symbol: cleanSymbol };
  });

export const removeStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => symbolSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("watchlist_stocks")
      .delete()
      .eq("user_id", userId)
      .eq("symbol", data.symbol);
    if (error) throw new Error(error.message);
    return { ok: true, symbol: data.symbol };
  });

/** Persist the current market state as the user's checkpoint. */
export const saveCheckpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { getMarketProvider } = await import("@/lib/market/provider.server");

    const watchlist = await loadWatchlist(supabase, userId);
    const [{ data: rows }, { data: snapRows }] = await Promise.all([
      supabase.from("watchlist_stocks").select("symbol").eq("watchlist_id", watchlist.id),
      supabase
        .from("market_snapshots")
        .select("symbol, price, volume, captured_at")
        .eq("user_id", userId),
    ]);
    const symbols = [...(rows ?? []).map((r: { symbol: string }) => r.symbol), NIFTY, SENSEX];

    const quotes = await getMarketProvider().getQuotes(symbols);
    const now = new Date().toISOString();
    const bySymbol = new Map<string, Quote>(quotes.map((q) => [q.symbol, q]));
    const niftyChangePct = bySymbol.get(NIFTY)?.changePct ?? 0;
    const snapshots = new Map<string, Snapshot>(
      (snapRows ?? []).map((s: any) => [
        s.symbol,
        {
          symbol: s.symbol,
          price: Number(s.price),
          volume: Number(s.volume),
          capturedAt: s.captured_at,
        },
      ]),
    );
    const insights = (rows ?? [])
      .map((r: { symbol: string }) => bySymbol.get(r.symbol))
      .filter((q: Quote | undefined): q is Quote => Boolean(q))
      .map((quote: Quote) =>
        buildInsight({ quote, snapshot: snapshots.get(quote.symbol), niftyChangePct }),
      );
    const meaningful = insights.filter((i) => i.level !== "NORMAL" || i.signals.length > 0);

    if (meaningful.length) {
      const { error: historyError } = await supabase.from("change_history").insert(
        meaningful.map((insight) => ({
          user_id: userId,
          watchlist_id: watchlist.id,
          symbol: insight.quote.symbol,
          level: insight.level,
          attention_score: insight.attentionScore,
          price: insight.quote.price,
          change_pct: insight.quote.changePct,
          since_check_pct: insight.sinceCheckPct,
          relative_to_nifty: insight.relativeToNifty,
          volume: insight.quote.volume,
          volume_ratio: insight.quote.volumeRatio,
          headline: insight.headline,
          why: insight.why,
          signals: insight.signals,
          captured_at: now,
        })),
      );
      if (historyError) throw new Error(historyError.message);
    }

    if (quotes.length) {
      const { error } = await supabase.from("market_snapshots").upsert(
        quotes.map((q) => ({
          user_id: userId,
          symbol: q.symbol,
          price: q.price,
          volume: q.volume,
          captured_at: now,
        })),
        { onConflict: "user_id,symbol" },
      );
      if (error) throw new Error(error.message);
    }

    const { data: current } = await supabase
      .from("checkpoints")
      .select("last_checked_at")
      .eq("user_id", userId)
      .maybeSingle();

    const { error: cpError } = await supabase.from("checkpoints").upsert(
      {
        user_id: userId,
        last_checked_at: now,
        previous_checked_at: current?.last_checked_at ?? null,
      },
      { onConflict: "user_id" },
    );
    if (cpError) throw new Error(cpError.message);
    return { ok: true, checkpointAt: now, recordedChanges: meaningful.length };
  });

export const searchStocks = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ q: z.string().max(60).default("") }).parse(data))
  .handler(async ({ data }) => {
    const { getMarketProvider } = await import("@/lib/market/provider.server");
    const provider = getMarketProvider();
    return provider.searchSymbols(data.q);
  });

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, display_name, created_at")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data)
      return data as {
        id: string;
        email: string | null;
        display_name: string | null;
        created_at: string;
      };

    const email = typeof claims.email === "string" ? claims.email : null;
    const displayName = email?.split("@")[0] ?? "Investor";
    const { data: created, error: createError } = await supabase
      .from("profiles")
      .insert({ id: userId, email, display_name: displayName })
      .select("id, email, display_name, created_at")
      .single();
    if (createError) throw new Error(createError.message);
    return created as {
      id: string;
      email: string | null;
      display_name: string | null;
      created_at: string;
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ displayName: z.string().trim().min(1).max(80) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, display_name: data.displayName }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Reset demo checkpoint and snapshots to restore the seeded 4h 32m baseline. Only works in demo mode and development environment. */
export const resetDemoCheckpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { getMarketProvider } = await import("@/lib/market/provider.server");
    const provider = getMarketProvider();

    if (provider.id !== "demo") {
      throw new Error("Demo reset is only available in demo mode");
    }

    if (process.env["NODE_ENV"] === "production") {
      throw new Error("Demo reset is only available in development environment");
    }

    // Delete checkpoint and market snapshots to trigger re-seeding on next dashboard load
    await Promise.all([
      supabase.from("checkpoints").delete().eq("user_id", userId),
      supabase.from("market_snapshots").delete().eq("user_id", userId),
    ]);

    return { ok: true };
  });

/** Get user's change history for the Change History page. */
export const getChangeHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChangeHistoryPayload> => {
    const { supabase, userId } = context;

    const { data: historyRows, error } = await supabase
      .from("change_history")
      .select(
        "id, symbol, level, attention_score, price, change_pct, since_check_pct, relative_to_nifty, volume_ratio, headline, why, captured_at, signals",
      )
      .eq("user_id", userId)
      .order("captured_at", { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`Failed to fetch change history: ${error.message}`);
    }

    const items = (historyRows ?? []).map(toHistoryItem);

    return { items };
  });

export interface StockDetailPayload {
  insight: StockInsight;
  history: { t: string; price: number }[];
  range: string;
  nifty: IndexQuote | null;
  status: MarketStatus;
  inWatchlist: boolean;
  lastCheckedAt: string | null;
  events: { at: string; title: string; detail: string }[];
  historyEvents: ChangeHistoryItem[];
  fetchedAt: string;
}

export const getStockDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        symbol: z
          .string()
          .trim()
          .min(1)
          .transform((s) => normalizeSymbol(s)),
        range: z.enum(["1D", "1W", "1M", "1Y"]).default("1M"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<StockDetailPayload> => {
    const { supabase, userId } = context;
    const { getMarketProvider, getMarketStatus, toIndexQuote } =
      await import("@/lib/market/provider.server");
    const provider = getMarketProvider();
    const [
      quotes,
      history,
      { data: snapRow },
      { data: watchRow },
      { data: checkpoint },
      { data: historyRows },
    ] = await Promise.all([
      provider.getQuotes([data.symbol, NIFTY]),
      provider.getHistory(data.symbol, data.range),
      supabase
        .from("market_snapshots")
        .select("symbol, price, volume, captured_at")
        .eq("user_id", userId)
        .eq("symbol", data.symbol)
        .maybeSingle(),
      supabase
        .from("watchlist_stocks")
        .select("id")
        .eq("user_id", userId)
        .eq("symbol", data.symbol)
        .maybeSingle(),
      supabase.from("checkpoints").select("last_checked_at").eq("user_id", userId).maybeSingle(),
      supabase
        .from("change_history")
        .select(
          "id, symbol, level, attention_score, price, change_pct, since_check_pct, relative_to_nifty, volume_ratio, headline, why, captured_at",
        )
        .eq("user_id", userId)
        .eq("symbol", data.symbol)
        .order("captured_at", { ascending: false })
        .limit(6),
    ]);

    const quote = quotes.find((q) => q.symbol === data.symbol);
    if (!quote) throw new Error(`No quote available for ${data.symbol}`);
    const nifty = quotes.find((q) => q.symbol === NIFTY) ?? null;

    const insight = buildInsight({
      quote,
      snapshot: snapRow
        ? {
            symbol: snapRow.symbol,
            price: Number(snapRow.price),
            volume: Number(snapRow.volume),
            capturedAt: snapRow.captured_at,
          }
        : null,
      niftyChangePct: nifty?.changePct ?? 0,
    });

    const baseTime = Date.now();
    const events = insight.signals.slice(0, 3).map((s, i) => ({
      at: new Date(baseTime - (i + 1) * 37 * 60_000).toISOString(),
      title: s.label,
      detail: s.detail,
    }));
    events.push({
      at: new Date(baseTime - 4 * 60 * 60_000).toISOString(),
      title: "Session opened",
      detail: `Opened near ${quote.prevClose.toFixed(2)} with ${(quote.volumeRatio || 1).toFixed(1)}x average participation.`,
    });

    return {
      insight,
      history,
      range: data.range,
      nifty: nifty ? toIndexQuote(nifty) : null,
      status: getMarketStatus(),
      inWatchlist: Boolean(watchRow),
      lastCheckedAt: checkpoint?.last_checked_at ?? null,
      events,
      historyEvents: (historyRows ?? []).map(toHistoryItem),
      fetchedAt: new Date().toISOString(),
    };
  });
