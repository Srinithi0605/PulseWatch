export type AttentionLevel = "NORMAL" | "NOTABLE" | "SIGNIFICANT" | "CRITICAL";

export interface Quote {
  symbol: string;
  name: string;
  exchange: string;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  week52High: number;
  week52Low: number;
  high20: number;
  low20: number;
  volume: number;
  avgVolume: number;
  volumeRatio: number;
  updatedAt: string;
  source: "demo" | "live";
}

export interface Signal {
  kind: "MOVE" | "VOLUME" | "RELATIVE" | "RANGE";
  label: string;
  detail: string;
  tone: "positive" | "negative" | "notable" | "neutral";
}

export interface Snapshot {
  symbol: string;
  price: number;
  volume: number;
  capturedAt: string;
}

export interface StockInsight {
  quote: Quote;
  level: AttentionLevel;
  attentionScore: number;
  signals: Signal[];
  sinceCheckPct: number | null;
  sinceCheckAbs: number | null;
  relativeToNifty: number;
  headline: string;
  why: string;
}

export interface MarketStatus {
  isOpen: boolean;
  label: string;
  asOf: string;
}

export interface IndexQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
}
