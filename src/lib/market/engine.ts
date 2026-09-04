import type { AttentionLevel, Quote, Signal, Snapshot, StockInsight } from "./types";

export const LEVEL_ORDER: Record<AttentionLevel, number> = {
  NORMAL: 0,
  NOTABLE: 1,
  SIGNIFICANT: 2,
  CRITICAL: 3,
};

/** Movement magnitude thresholds: <1% normal, >=1% notable, >=2% significant, >=5% critical. */
export function classifyMove(absPct: number): AttentionLevel {
  if (absPct >= 5) return "CRITICAL";
  if (absPct >= 2) return "SIGNIFICANT";
  if (absPct >= 1) return "NOTABLE";
  return "NORMAL";
}

export const UNUSUAL_VOLUME_RATIO = 1.5;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function fmtPct(value: number, digits = 2) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function fmtInr(value: number) {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtVolume(value: number) {
  if (value >= 10_000_000) return `${(value / 10_000_000).toFixed(2)} Cr`;
  if (value >= 100_000) return `${(value / 100_000).toFixed(2)} L`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)} K`;
  return String(Math.round(value));
}

export function timeAgo(iso: string, now = Date.now()) {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec} sec ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export interface InsightInput {
  quote: Quote;
  snapshot?: Snapshot | null | undefined;
  niftyChangePct: number;
}

/**
 * The meaningful-change engine. Combines movement magnitude, unusual volume,
 * relative performance vs NIFTY and 20-day range breaks into a 0-100
 * Attention Score plus a human explanation.
 */
export function buildInsight({ quote, snapshot, niftyChangePct }: InsightInput): StockInsight {
  const sinceCheckPct =
    snapshot && snapshot.price > 0 ? ((quote.price - snapshot.price) / snapshot.price) * 100 : null;
  const sinceCheckAbs = snapshot ? quote.price - snapshot.price : null;
  const relativeToNifty = quote.changePct - niftyChangePct;

  const signals: Signal[] = [];
  const moveLevel = classifyMove(Math.abs(quote.changePct));
  const sinceLevel = classifyMove(Math.abs(sinceCheckPct ?? 0));
  let level: AttentionLevel =
    LEVEL_ORDER[moveLevel] >= LEVEL_ORDER[sinceLevel] ? moveLevel : sinceLevel;

  if (moveLevel !== "NORMAL") {
    signals.push({
      kind: "MOVE",
      label: quote.changePct >= 0 ? "Strong upmove" : "Sharp decline",
      detail: `${fmtPct(quote.changePct)} today (${moveLevel.toLowerCase()} movement)`,
      tone: quote.changePct >= 0 ? "positive" : "negative",
    });
  }

  const unusualVolume = !quote.avgVolume ? false : quote.volumeRatio >= UNUSUAL_VOLUME_RATIO;
  if (unusualVolume) {
    if (level === "NORMAL") level = "NOTABLE";
    signals.push({
      kind: "VOLUME",
      label: "Unusual activity",
      detail: `Trading at ${quote.volumeRatio.toFixed(1)}x normal volume`,
      tone: "notable",
    });
  }

  if (Math.abs(relativeToNifty) >= 1) {
    signals.push({
      kind: "RELATIVE",
      label: relativeToNifty > 0 ? "Outperforming NIFTY" : "Underperforming NIFTY",
      detail:
        relativeToNifty > 0
          ? `Outperformed NIFTY by ${relativeToNifty.toFixed(1)}%`
          : `Fell ${Math.abs(relativeToNifty).toFixed(1)}% more than NIFTY`,
      tone: relativeToNifty > 0 ? "positive" : "negative",
    });
  }

  const brokeHigh = quote.price >= quote.high20;
  const brokeLow = quote.price <= quote.low20;
  if (brokeHigh || brokeLow) {
    if (level === "NORMAL") level = "NOTABLE";
    signals.push({
      kind: "RANGE",
      label: brokeHigh ? "20-day high break" : "20-day low break",
      detail: brokeHigh
        ? `Trading above its 20-day high of ${fmtInr(quote.high20)}`
        : `Trading below its 20-day low of ${fmtInr(quote.low20)}`,
      tone: brokeHigh ? "positive" : "negative",
    });
  }

  const magnitudeScore = clamp(Math.abs(quote.changePct) * 11, 0, 55);
  const volumeScore = quote.avgVolume ? clamp((quote.volumeRatio - 1) * 20, 0, 20) : 0;
  const relativeScore = clamp(Math.abs(relativeToNifty) * 4, 0, 15);
  const rangeScore = brokeHigh || brokeLow ? 12 : 0;
  const sinceScore = clamp(Math.abs(sinceCheckPct ?? 0) * 5, 0, 10);
  const attentionScore = Math.round(
    clamp(magnitudeScore + volumeScore + relativeScore + rangeScore + sinceScore, 0, 100),
  );

  const primary = signals[0];
  const headline = primary
    ? primary.detail
    : `Trading ${fmtPct(quote.changePct)} — nothing unusual`;

  const whyParts: string[] = [];
  if (moveLevel !== "NORMAL")
    whyParts.push(
      `A ${Math.abs(quote.changePct).toFixed(1)}% move is classified as ${moveLevel.toLowerCase()} for this stock.`,
    );
  if (unusualVolume)
    whyParts.push(
      `Volume is ${quote.volumeRatio.toFixed(1)}x its recent average, so conviction behind the move is higher than usual.`,
    );
  if (Math.abs(relativeToNifty) >= 1)
    whyParts.push(
      relativeToNifty > 0
        ? `It is beating NIFTY by ${relativeToNifty.toFixed(1)}% today, so this is stock-specific strength, not the market.`
        : `It is lagging NIFTY by ${Math.abs(relativeToNifty).toFixed(1)}% today, so this is stock-specific weakness, not the market.`,
    );
  if (brokeHigh || brokeLow)
    whyParts.push(
      brokeHigh
        ? "Price has broken out above its 20-day range."
        : "Price has broken down below its 20-day range.",
    );
  if (sinceCheckPct !== null && Math.abs(sinceCheckPct) >= 0.5)
    whyParts.push(
      `It has moved ${fmtPct(sinceCheckPct)} since you last checked.`,
    );
  if (!whyParts.length)
    whyParts.push("Movement, volume and relative performance are all inside normal ranges.");

  return {
    quote,
    level,
    attentionScore,
    signals,
    sinceCheckPct,
    sinceCheckAbs,
    relativeToNifty,
    headline,
    why: whyParts.join(" "),
  };
}

export function rankInsights(insights: StockInsight[]) {
  return [...insights].sort((a, b) => {
    const byLevel = LEVEL_ORDER[b.level] - LEVEL_ORDER[a.level];
    if (byLevel !== 0) return byLevel;
    return b.attentionScore - a.attentionScore;
  });
}

export function meaningfulOnly(insights: StockInsight[]) {
  return rankInsights(insights).filter((i) => i.level !== "NORMAL" || i.signals.length > 0);
}
