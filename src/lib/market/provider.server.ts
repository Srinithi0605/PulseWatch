import { NIFTY, UNIVERSE_MAP, type SymbolMeta } from "./universe";
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

export interface MarketProvider {
  id: "demo" | "live";
  getQuotes(symbols: string[], now?: number): Promise<Quote[]>;
  getHistory(symbol: string, range: HistoryRange, now?: number): Promise<HistoryPoint[]>;
}

export type HistoryRange = "1D" | "1W" | "1M" | "1Y";
export interface HistoryPoint {
  t: string;
  price: number;
}

const TICK_MS = 15_000;
const DAY_MS = 86_400_000;

function baseFor(meta: SymbolMeta, day: number) {
  // Slow multi-day drift so prices are not frozen day to day.
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

  const volumeRatio = meta.isIndex ? 0 : Number((0.55 + rng(meta.symbol, "vol", day)() * 1.75).toFixed(2));
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
    const blended = scaled * (1 - progress) + (quote.price * (w / last)) * progress;
    return {
      t: new Date(now - (points - 1 - i) * stepMs).toISOString(),
      price: Number(blended.toFixed(2)),
    };
  });
}

export const demoMarketProvider: MarketProvider = {
  id: "demo",
  async getQuotes(symbols, now = Date.now()) {
    return symbols
      .map((s) => UNIVERSE_MAP[s.toUpperCase()])
      .filter((m): m is SymbolMeta => Boolean(m))
      .map((m) => buildQuote(m, now));
  },
  async getHistory(symbol, range, now = Date.now()) {
    const meta = UNIVERSE_MAP[symbol.toUpperCase()];
    if (!meta) return [];
    return buildHistory(meta, range, now);
  },
};

/**
 * Optional live provider. Disabled unless MARKET_API_URL is configured; any
 * failure falls back to deterministic demo data so the app is never broken.
 */
export function getMarketProvider(): MarketProvider {
  const liveUrl = process.env["MARKET_API_URL"];
  if (!liveUrl) return demoMarketProvider;

  return {
    id: "live",
    async getQuotes(symbols, now = Date.now()) {
      try {
        const res = await fetch(`${liveUrl}/quotes?symbols=${symbols.join(",")}`, {
          headers: { authorization: `Bearer ${process.env["MARKET_API_KEY"] ?? ""}` },
        });
        if (!res.ok) throw new Error(`live provider ${res.status}`);
        const json = (await res.json()) as { quotes?: Quote[] };
        if (!json.quotes?.length) throw new Error("live provider returned no quotes");
        return json.quotes.map((q) => ({ ...q, source: "live" as const }));
      } catch (error) {
        console.error("Live market provider failed, falling back to demo data", error);
        return demoMarketProvider.getQuotes(symbols, now);
      }
    },
    async getHistory(symbol, range, now = Date.now()) {
      return demoMarketProvider.getHistory(symbol, range, now);
    },
  };
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
  return { symbol: q.symbol, name: q.name, price: q.price, change: q.change, changePct: q.changePct };
}

export { NIFTY };
