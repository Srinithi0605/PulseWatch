import {
  NIFTY,
  UNIVERSE_MAP,
  getSymbolMeta,
  normalizeSymbol,
  toYahooSymbol,
  type SymbolMeta,
} from "./universe";
import type { IndexQuote, MarketStatus, Quote } from "./types";

/* ------------------------------------------------------------------ */
/* Deterministic pseudo-random helpers                                  */
/* ------------------------------------------------------------------ */

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rng(...parts: (string | number)[]) {
  return mulberry32(hashString(parts.join("|")));
}

/* ------------------------------------------------------------------ */
/* Market provider abstraction                                          */
/* ------------------------------------------------------------------ */

export interface SearchResultItem {
  symbol: string;
  name: string;
  exchange: string;
  price: number;
  changePct: number;
  updatedAt: string;
  source: "live" | "demo";
}

export interface MarketProvider {
  id: "demo" | "live";
  getQuotes(symbols: string[], now?: number): Promise<Quote[]>;
  getHistory(symbol: string, range: HistoryRange, now?: number): Promise<HistoryPoint[]>;
  searchSymbols(query: string, now?: number): Promise<SearchResultItem[]>;
}

export type HistoryRange = "1D" | "1W" | "1M" | "1Y";
export interface HistoryPoint {
  t: string;
  price: number;
}

const TICK_MS = 15_000;
const DAY_MS = 86_400_000;

function baseFor(meta: SymbolMeta, day: number) {
  const r = rng(meta.symbol, "drift", Math.floor(day / 3));
  return meta.base * (1 + (r() - 0.5) * 0.06);
}

function dailyChangePct(symbol: string, day: number) {
  const r = rng(symbol, "day", day);
  let pct = (r() * 2 - 1) * 2.6;
  const shock = r();
  if (shock > 0.9) pct *= 2.4;
  else if (shock > 0.75) pct *= 1.6;
  return pct;
}

function buildQuote(meta: SymbolMeta, now: number): Quote {
  const day = Math.floor(now / DAY_MS);
  const tick = Math.floor(now / TICK_MS);
  const prevClose = Number(baseFor(meta, day).toFixed(2));
  const wobble = (rng(meta.symbol, "tick", tick)() * 2 - 1) * (meta.isIndex ? 0.12 : 0.4);
  const changePct = dailyChangePct(meta.symbol, day) * (meta.isIndex ? 0.35 : 1) + wobble;
  const price = Number((prevClose * (1 + changePct / 100)).toFixed(2));
  const change = Number((price - prevClose).toFixed(2));

  const rd = rng(meta.symbol, "range", day);
  const dayHigh = Number((Math.max(price, prevClose) * (1 + rd() * 0.006)).toFixed(2));
  const dayLow = Number((Math.min(price, prevClose) * (1 - rd() * 0.006)).toFixed(2));

  const volumeRatio = meta.isIndex
    ? 0
    : Number((0.55 + rng(meta.symbol, "vol", day)() * 1.75).toFixed(2));
  const volume = Math.round(meta.avgVolume * (volumeRatio || 0));

  const bandUp = 0.02 + rd() * 0.05;
  const bandDown = 0.02 + rd() * 0.05;
  const high20 = Number((prevClose * (1 + bandUp)).toFixed(2));
  const low20 = Number((prevClose * (1 - bandDown)).toFixed(2));

  return {
    symbol: meta.symbol,
    name: meta.name,
    exchange: meta.exchange,
    price,
    prevClose,
    change,
    changePct: Number(changePct.toFixed(2)),
    dayHigh,
    dayLow,
    week52High: Number((prevClose * (1.18 + rd() * 0.2)).toFixed(2)),
    week52Low: Number((prevClose * (0.68 + rd() * 0.12)).toFixed(2)),
    high20,
    low20,
    volume,
    avgVolume: meta.avgVolume,
    volumeRatio,
    updatedAt: new Date(Math.floor(now / TICK_MS) * TICK_MS).toISOString(),
    source: "demo",
  };
}

function buildHistory(meta: SymbolMeta, range: HistoryRange, now: number): HistoryPoint[] {
  const quote = buildQuote(meta, now);
  const config: Record<HistoryRange, { points: number; stepMs: number; vol: number }> = {
    "1D": { points: 78, stepMs: 5 * 60_000, vol: 0.0022 },
    "1W": { points: 60, stepMs: 2 * 60 * 60_000, vol: 0.005 },
    "1M": { points: 30, stepMs: DAY_MS, vol: 0.011 },
    "1Y": { points: 52, stepMs: 7 * DAY_MS, vol: 0.026 },
  };
  const { points, stepMs, vol } = config[range];
  const r = rng(meta.symbol, "hist", range, Math.floor(now / DAY_MS));

  const walk: number[] = [];
  let value = 1;
  for (let i = 0; i < points; i++) {
    value *= 1 + (r() - 0.5) * 2 * vol;
    walk.push(value);
  }
  const last = walk[walk.length - 1] ?? 1;
  const startAnchor = range === "1D" ? quote.prevClose : quote.price / (1 + (r() - 0.5) * 0.2);

  return walk.map((w, i) => {
    const progress = i / Math.max(1, points - 1);
    const scaled = startAnchor * (w / walk[0]!);
    const blended = scaled * (1 - progress) + quote.price * (w / last) * progress;
    return {
      t: new Date(now - (points - 1 - i) * stepMs).toISOString(),
      price: Number(blended.toFixed(2)),
    };
  });
}

export const demoMarketProvider: MarketProvider = {
  id: "demo",
  async getQuotes(symbols, now = Date.now()) {
    return symbols.map((s) => buildQuote(getSymbolMeta(s), now));
  },
  async getHistory(symbol, range, now = Date.now()) {
    return buildHistory(getSymbolMeta(symbol), range, now);
  },
  async searchSymbols(query, now = Date.now()) {
    const q = query.trim().toLowerCase();
    const symbols = Object.values(UNIVERSE_MAP).filter(
      (m) => !m.isIndex && (m.symbol.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)),
    );
    if (symbols.length === 0 && q) {
      const fallbackMeta = getSymbolMeta(q.toUpperCase(), q.toUpperCase());
      symbols.push(fallbackMeta);
    }
    return symbols.map((meta) => {
      const q = buildQuote(meta, now);
      return {
        symbol: meta.symbol,
        name: meta.name,
        exchange: meta.exchange,
        price: q.price,
        changePct: q.changePct,
        updatedAt: q.updatedAt,
        source: "demo",
      };
    });
  },
};

async function fetchLiveQuote(symbol: string, now: number): Promise<Quote | null> {
  const meta = getSymbolMeta(symbol);
  try {
    const yTicker = toYahooSymbol(symbol);
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yTicker)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const m = result?.meta;
    if (!m) return null;

    const basePrice = meta.base || 100;
    const price = Number((m.regularMarketPrice ?? m.fulldayPrice ?? basePrice).toFixed(2));
    const prevClose = Number((m.chartPreviousClose ?? price).toFixed(2));
    const change = Number((price - prevClose).toFixed(2));
    const changePct = Number(
      (m.regularMarketChangePercent ?? m.fulldayChangePercent ?? 0).toFixed(2),
    );
    const dayHigh = Number((m.regularMarketDayHigh ?? Math.max(price, prevClose)).toFixed(2));
    const dayLow = Number((m.regularMarketDayLow ?? Math.min(price, prevClose)).toFixed(2));
    const week52High = Number((m.fiftyTwoWeekHigh ?? price * 1.15).toFixed(2));
    const week52Low = Number((m.fiftyTwoWeekLow ?? price * 0.85).toFixed(2));
    const volume = Number(m.regularMarketVolume ?? 0);
    const avgVol = meta.avgVolume || 1_000_000;
    const volumeRatio = avgVol ? Number((volume / avgVol).toFixed(2)) : 0;
    const high20 = Number((prevClose * 1.03).toFixed(2));
    const low20 = Number((prevClose * 0.97).toFixed(2));

    const clean = normalizeSymbol(symbol);
    return {
      symbol: clean,
      name: m.longName || m.shortName || meta.name || clean,
      exchange:
        m.exchangeName === "NSI" || m.fullExchangeName === "NSE"
          ? "NSE"
          : m.exchangeName === "BSE"
            ? "BSE"
            : meta.exchange || "NSE",
      price,
      prevClose,
      change,
      changePct,
      dayHigh,
      dayLow,
      week52High,
      week52Low,
      high20,
      low20,
      volume,
      avgVolume: avgVol,
      volumeRatio,
      updatedAt: new Date(now).toISOString(),
      source: "live",
    };
  } catch {
    return null;
  }
}

async function fetchLiveHistory(
  symbol: string,
  range: HistoryRange,
  now: number,
): Promise<HistoryPoint[] | null> {
  try {
    const yTicker = toYahooSymbol(symbol);
    const paramsMap: Record<HistoryRange, { range: string; interval: string }> = {
      "1D": { range: "1d", interval: "5m" },
      "1W": { range: "5d", interval: "15m" },
      "1M": { range: "1mo", interval: "1d" },
      "1Y": { range: "1y", interval: "1wk" },
    };
    const { range: pRange, interval: pInterval } = paramsMap[range];
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yTicker)}?range=${pRange}&interval=${pInterval}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const timestamps: number[] = result?.timestamp || [];
    const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close || [];
    if (!timestamps.length || !closes.length) return null;

    const points: HistoryPoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const price = closes[i];
      const t = timestamps[i];
      if (price !== null && price !== undefined && !isNaN(price) && t) {
        points.push({
          t: new Date(t * 1000).toISOString(),
          price: Number(price.toFixed(2)),
        });
      }
    }
    return points.length ? points : null;
  } catch {
    return null;
  }
}

export const yahooMarketProvider: MarketProvider = {
  id: "live",
  async getQuotes(symbols, now = Date.now()) {
    const liveQuotes = await Promise.all(symbols.map((s) => fetchLiveQuote(s, now)));
    return symbols.map((symbol, idx) => {
      const live = liveQuotes[idx];
      if (live) return live;
      return buildQuote(getSymbolMeta(symbol), now);
    });
  },
  async getHistory(symbol, range, now = Date.now()) {
    const liveHistory = await fetchLiveHistory(symbol, range, now);
    if (liveHistory && liveHistory.length > 0) return liveHistory;
    return buildHistory(getSymbolMeta(symbol), range, now);
  },
  async searchSymbols(query, now = Date.now()) {
    const q = query.trim();
    if (!q) {
      // Default initial items if query is empty
      const defaultSymbols = [
        "RELIANCE",
        "TCS",
        "INFY",
        "HDFCBANK",
        "ICICIBANK",
        "SBIN",
        "ITC",
        "TATAMOTORS",
      ];
      const quotes = await this.getQuotes(defaultSymbols, now);
      return quotes.map((quote) => ({
        symbol: quote.symbol,
        name: quote.name,
        exchange: quote.exchange,
        price: quote.price,
        changePct: quote.changePct,
        updatedAt: quote.updatedAt,
        source: "live",
      }));
    }

    try {
      const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0`;
      const res = await fetch(searchUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      });
      if (!res.ok) throw new Error(`search failed ${res.status}`);
      const json = await res.json();
      const rawQuotes = (json?.quotes || []) as any[];

      // Filter equities, ETFs, and indices
      const filtered = rawQuotes.filter(
        (item) =>
          item.quoteType === "EQUITY" || item.quoteType === "ETF" || item.quoteType === "INDEX",
      );

      // Prioritize Indian NSE/BSE stocks (.NS / .BO)
      const sorted = filtered.sort((a, b) => {
        const aIsIndian =
          a.symbol?.endsWith(".NS") ||
          a.symbol?.endsWith(".BO") ||
          a.exchange === "NSI" ||
          a.exchange === "BSE";
        const bIsIndian =
          b.symbol?.endsWith(".NS") ||
          b.symbol?.endsWith(".BO") ||
          b.exchange === "NSI" ||
          b.exchange === "BSE";
        if (aIsIndian && !bIsIndian) return -1;
        if (!aIsIndian && bIsIndian) return 1;
        return 0;
      });

      const topMatches = sorted.slice(0, 10);
      if (!topMatches.length) {
        return demoMarketProvider.searchSymbols(q, now);
      }

      // Fetch live price quotes for resolved search matches
      const resolvedSymbols = topMatches.map((item) => item.symbol as string);
      const quotes = await Promise.all(
        topMatches.map(async (item) => {
          const sym = item.symbol as string;
          const clean = normalizeSymbol(sym);
          const liveQuote = await fetchLiveQuote(sym, now);
          const exch =
            item.exchDisp ||
            (sym.endsWith(".NS") ? "NSE" : sym.endsWith(".BO") ? "BSE" : item.exchange || "NSE");
          const name = item.longname || item.shortname || clean;

          if (liveQuote) {
            return {
              symbol: clean,
              name,
              exchange: exch,
              price: liveQuote.price,
              changePct: liveQuote.changePct,
              updatedAt: liveQuote.updatedAt,
              source: "live" as const,
            };
          }

          const fallback = buildQuote(getSymbolMeta(clean, name, exch), now);
          return {
            symbol: clean,
            name,
            exchange: exch,
            price: fallback.price,
            changePct: fallback.changePct,
            updatedAt: fallback.updatedAt,
            source: "demo" as const,
          };
        }),
      );

      return quotes;
    } catch (error) {
      console.error("Live symbol search failed, falling back to demo search", error);
      return demoMarketProvider.searchSymbols(q, now);
    }
  },
};

/**
 * Returns live market provider by default, falling back to demo data if offline.
 */
export function getMarketProvider(): MarketProvider {
  const customLiveUrl = process.env["MARKET_API_URL"];
  if (customLiveUrl) {
    return {
      id: "live",
      async getQuotes(symbols, now = Date.now()) {
        try {
          const res = await fetch(`${customLiveUrl}/quotes?symbols=${symbols.join(",")}`, {
            headers: { authorization: `Bearer ${process.env["MARKET_API_KEY"] ?? ""}` },
          });
          if (!res.ok) throw new Error(`custom provider ${res.status}`);
          const json = (await res.json()) as { quotes?: Quote[] };
          if (!json.quotes?.length) throw new Error("custom provider returned no quotes");
          return json.quotes.map((q) => ({ ...q, source: "live" as const }));
        } catch (error) {
          console.error(
            "Custom market provider failed, falling back to live Yahoo provider",
            error,
          );
          return yahooMarketProvider.getQuotes(symbols, now);
        }
      },
      async getHistory(symbol, range, now = Date.now()) {
        return yahooMarketProvider.getHistory(symbol, range, now);
      },
      async searchSymbols(query, now = Date.now()) {
        return yahooMarketProvider.searchSymbols(query, now);
      },
    };
  }

  if (process.env["USE_DEMO_MARKET"] === "true") {
    return demoMarketProvider;
  }

  return yahooMarketProvider;
}

export function getMarketStatus(now = Date.now()): MarketStatus {
  // NSE trading hours: 09:15–15:30 IST, Mon–Fri.
  const ist = new Date(now + 5.5 * 60 * 60 * 1000);
  const day = ist.getUTCDay();
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const weekday = day >= 1 && day <= 5;
  const isOpen = weekday && minutes >= 555 && minutes <= 930;
  return {
    isOpen,
    label: isOpen ? "Market Open" : weekday ? "Market Closed" : "Weekend — Market Closed",
    asOf: new Date(now).toISOString(),
  };
}

export function toIndexQuote(q: Quote): IndexQuote {
  return {
    symbol: q.symbol,
    name: q.name,
    price: q.price,
    change: q.change,
    changePct: q.changePct,
  };
}

export { NIFTY };
