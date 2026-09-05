export interface SymbolMeta {
  symbol: string;
  name: string;
  sector: string;
  exchange: string;
  base: number;
  avgVolume: number;
  isIndex?: boolean;
}

export const UNIVERSE: SymbolMeta[] = [
  {
    symbol: "RELIANCE",
    name: "Reliance Industries",
    sector: "Energy",
    exchange: "NSE",
    base: 2914,
    avgVolume: 7_400_000,
  },
  {
    symbol: "TCS",
    name: "Tata Consultancy Services",
    sector: "IT Services",
    exchange: "NSE",
    base: 3860,
    avgVolume: 2_100_000,
  },
  {
    symbol: "INFY",
    name: "Infosys",
    sector: "IT Services",
    exchange: "NSE",
    base: 1562,
    avgVolume: 6_800_000,
  },
  {
    symbol: "HDFCBANK",
    name: "HDFC Bank",
    sector: "Banking",
    exchange: "NSE",
    base: 1687,
    avgVolume: 12_500_000,
  },
  {
    symbol: "ICICIBANK",
    name: "ICICI Bank",
    sector: "Banking",
    exchange: "NSE",
    base: 1204,
    avgVolume: 10_900_000,
  },
  {
    symbol: "SBIN",
    name: "State Bank of India",
    sector: "Banking",
    exchange: "NSE",
    base: 819,
    avgVolume: 15_200_000,
  },
  {
    symbol: "ITC",
    name: "ITC Limited",
    sector: "FMCG",
    exchange: "NSE",
    base: 441,
    avgVolume: 13_800_000,
  },
  {
    symbol: "BHARTIARTL",
    name: "Bharti Airtel",
    sector: "Telecom",
    exchange: "NSE",
    base: 1498,
    avgVolume: 5_600_000,
  },
  {
    symbol: "LT",
    name: "Larsen & Toubro",
    sector: "Infrastructure",
    exchange: "NSE",
    base: 3592,
    avgVolume: 2_400_000,
  },
  {
    symbol: "TATAMOTORS",
    name: "Tata Motors",
    sector: "Automobile",
    exchange: "NSE",
    base: 978,
    avgVolume: 18_300_000,
  },
  {
    symbol: "NIFTY50",
    name: "NIFTY 50",
    sector: "Index",
    exchange: "NSE",
    base: 24218,
    avgVolume: 0,
    isIndex: true,
  },
  {
    symbol: "SENSEX",
    name: "SENSEX",
    sector: "Index",
    exchange: "BSE",
    base: 79541,
    avgVolume: 0,
    isIndex: true,
  },
];

export const UNIVERSE_MAP: Record<string, SymbolMeta> = Object.fromEntries(
  UNIVERSE.map((s) => [s.symbol, s]),
);

export const TRADABLE = UNIVERSE.filter((s) => !s.isIndex);

export const NIFTY = "NIFTY50";
export const SENSEX = "SENSEX";

export function normalizeSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  if (s.endsWith(".NS")) return s.replace(/\.NS$/, "");
  return s;
}

export function toYahooSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  if (upper === "NIFTY50" || upper === "NIFTY") return "^NSEI";
  if (upper === "SENSEX") return "^BSESN";
  if (upper.startsWith("^") || upper.includes(".")) return upper;
  return `${upper}.NS`;
}

export function getSymbolMeta(symbol: string, name?: string, exchange?: string): SymbolMeta {
  const clean = normalizeSymbol(symbol);
  const known = UNIVERSE_MAP[clean] || UNIVERSE_MAP[symbol.toUpperCase()];
  if (known) return known;

  const isBse = symbol.toUpperCase().endsWith(".BO") || exchange?.toUpperCase() === "BSE";
  return {
    symbol: clean,
    name: name || clean,
    sector: "Equity",
    exchange: exchange || (isBse ? "BSE" : "NSE"),
    base: 100,
    avgVolume: 1_000_000,
  };
}

export function isKnownSymbol(symbol: string) {
  return Boolean(UNIVERSE_MAP[normalizeSymbol(symbol)]);
}

export function searchUniverse(term: string) {
  const q = term.trim().toLowerCase();
  if (!q) return TRADABLE;
  return TRADABLE.filter(
    (s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
  );
}
