import type { StockInsight } from "./types";

export interface PulseNarrative {
  summary: string;
  marketChange: number;
  watchlistChange: number;
  outperformance: number;
  outperformingCount: number;
  totalStocks: number;
  strongestOutlier: { symbol: string; name: string; changePct: number } | null;
  unusualVolumeStocks: { symbol: string; name: string; volumeRatio: number }[];
  isCalm: boolean;
}

export function generatePulseNarrative(
  insights: StockInsight[],
  niftyChangePct: number,
): PulseNarrative | null {
  if (insights.length === 0) {
    return null;
  }

  const totalStocks = insights.length;
  const avgChangePct = insights.reduce((sum, i) => sum + i.quote.changePct, 0) / totalStocks;
  const outperformingCount = insights.filter((i) => i.quote.changePct > niftyChangePct).length;
  const underperformingCount = insights.filter((i) => i.quote.changePct < niftyChangePct).length;
  const outperformance = avgChangePct - niftyChangePct;

  // Find strongest outlier (stock with highest absolute change that's also outperforming/underperforming significantly)
  const strongestOutlier = [...insights].sort(
    (a, b) => Math.abs(b.quote.changePct) - Math.abs(a.quote.changePct),
  )[0];
  const outlierData = strongestOutlier
    ? {
        symbol: strongestOutlier.quote.symbol,
        name: strongestOutlier.quote.name,
        changePct: strongestOutlier.quote.changePct,
      }
    : null;

  // Find unusual volume stocks
  const unusualVolumeStocks = insights
    .filter((i) => i.quote.volumeRatio >= 1.5)
    .map((i) => ({
      symbol: i.quote.symbol,
      name: i.quote.name,
      volumeRatio: i.quote.volumeRatio,
    }));

  // Determine if market/watchlist is calm or showing concentrated movement
  const avgAbsChange =
    insights.reduce((sum, i) => sum + Math.abs(i.quote.changePct), 0) / totalStocks;
  const isCalm = avgAbsChange < 0.5 && Math.abs(niftyChangePct) < 0.5;

  // Generate narrative
  const parts: string[] = [];

  // Market state
  if (Math.abs(niftyChangePct) < 0.3) {
    parts.push("Markets are relatively flat");
  } else if (niftyChangePct > 0) {
    parts.push("Markets are up");
  } else {
    parts.push("Markets are down");
  }

  // Watchlist performance
  if (Math.abs(outperformance) < 0.3) {
    parts.push("and your watchlist is moving with the market");
  } else if (outperformance > 0) {
    parts.push("but your watchlist is showing stock-specific strength");
  } else {
    parts.push("and your watchlist is lagging the market");
  }

  // Outperforming/underperforming count
  if (outperformingCount > 0 || underperformingCount > 0) {
    parts.push(
      `${outperformingCount} of ${totalStocks} stocks are outperforming NIFTY${underperformingCount > 0 ? ` and ${underperformingCount} are underperforming` : ""}.`,
    );
  }

  // Strongest outlier
  if (outlierData && Math.abs(outlierData.changePct) >= 1) {
    parts.push(`${outlierData.symbol} is the strongest outlier`);
  }

  // Unusual volume
  if (unusualVolumeStocks.length > 0) {
    const volStock = unusualVolumeStocks[0];
    if (volStock) {
      if (unusualVolumeStocks.length === 1) {
        parts.push(`while ${volStock.symbol} is showing unusually high volume`);
      } else {
        parts.push(
          `while ${volStock.symbol} and ${unusualVolumeStocks.length - 1} other${unusualVolumeStocks.length > 2 ? "s" : ""} are showing unusually high volume`,
        );
      }
    }
  }

  // Calm vs concentrated
  if (isCalm) {
    parts.push("Overall activity is calm.");
  } else if (avgAbsChange > 1.5) {
    parts.push("Movement is concentrated in specific stocks.");
  }

  const summary = parts.join(". ");

  return {
    summary,
    marketChange: niftyChangePct,
    watchlistChange: avgChangePct,
    outperformance,
    outperformingCount,
    totalStocks,
    strongestOutlier: outlierData,
    unusualVolumeStocks,
    isCalm,
  };
}

export function getAttentionScoreBreakdown(insight: StockInsight) {
  const { quote, signals, sinceCheckPct, relativeToNifty } = insight;

  const magnitudeScore = Math.min(Math.abs(quote.changePct) * 11, 55);
  const volumeScore = quote.avgVolume ? Math.min((quote.volumeRatio - 1) * 20, 20) : 0;
  const relativeScore = Math.min(Math.abs(relativeToNifty) * 4, 15);
  const brokeHigh = quote.price >= quote.high20;
  const brokeLow = quote.price <= quote.low20;
  const rangeScore = brokeHigh || brokeLow ? 12 : 0;
  const sinceScore = Math.min(Math.abs(sinceCheckPct ?? 0) * 5, 10);

  const components = [
    {
      name: "Price movement",
      points: Math.round(magnitudeScore),
      max: 55,
      detail: `${Math.abs(quote.changePct).toFixed(2)}% move today`,
    },
  ];

  if (volumeScore > 0) {
    components.push({
      name: "Volume anomaly",
      points: Math.round(volumeScore),
      max: 20,
      detail: `${quote.volumeRatio.toFixed(1)}x normal volume`,
    });
  }

  if (relativeScore > 0) {
    components.push({
      name: "Relative to NIFTY",
      points: Math.round(relativeScore),
      max: 15,
      detail: `${relativeToNifty > 0 ? "+" : ""}${relativeToNifty.toFixed(2)}% vs NIFTY`,
    });
  }

  if (rangeScore > 0) {
    components.push({
      name: "Range breakout",
      points: rangeScore,
      max: 12,
      detail: brokeHigh ? "Above 20-day high" : "Below 20-day low",
    });
  }

  if (sinceScore > 0) {
    components.push({
      name: "Since last check",
      points: Math.round(sinceScore),
      max: 10,
      detail: `${sinceCheckPct && sinceCheckPct > 0 ? "+" : ""}${(sinceCheckPct ?? 0).toFixed(2)}%`,
    });
  }

  const total = components.reduce((sum, c) => sum + c.points, 0);

  return {
    total: Math.min(total, 100),
    components,
  };
}
