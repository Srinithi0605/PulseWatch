import { Zap, TrendingUp, TrendingDown, Activity } from "lucide-react";

import { cn } from "@/lib/utils";
import { fmtPct } from "@/lib/market/engine";
import { generatePulseNarrative } from "@/lib/market/pulse";
import type { DashboardPayload } from "@/lib/marketpulse.functions";

export function TodaysPulse({ data }: { data: DashboardPayload }) {
  const { insights, indices, watchlistPerformance } = data;

  // Get NIFTY from indices
  const nifty = indices.find((i) => i.symbol === "NIFTY 50");
  const niftyChangePct = nifty?.changePct ?? 0;

  // Generate narrative
  const narrative = generatePulseNarrative(insights, niftyChangePct);

  if (!narrative) {
    return null;
  }

  const {
    summary,
    marketChange,
    watchlistChange,
    outperformance,
    outperformingCount,
    totalStocks,
    strongestOutlier,
    unusualVolumeStocks,
    isCalm,
  } = narrative;

  // Calculate noise filtered
  const normalStocks = insights.filter((i) => i.level === "NORMAL" && i.signals.length === 0);
  const noiseCount = normalStocks.length;
  const meaningfulCount = insights.length - noiseCount;

  return (
    <section className="rounded-2xl border border-primary/25 bg-surface p-5">
      <div className="flex items-center gap-2">
        <Zap className="size-4 text-primary" />
        <h2 className="font-display text-lg font-semibold">Today's Pulse</h2>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-foreground/90">{summary}</p>

      {/* Evidence section */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface-elevated px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Market</p>
          <p
            className={cn(
              "mt-1 text-sm font-medium",
              marketChange >= 0 ? "text-positive" : "text-negative",
            )}
          >
            {fmtPct(marketChange)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface-elevated px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Your watchlist
          </p>
          <p
            className={cn(
              "mt-1 text-sm font-medium",
              watchlistChange >= 0 ? "text-positive" : "text-negative",
            )}
          >
            {fmtPct(watchlistChange)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface-elevated px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Outperformance
          </p>
          <p
            className={cn(
              "mt-1 text-sm font-medium",
              outperformance >= 0 ? "text-positive" : "text-negative",
            )}
          >
            {fmtPct(outperformance)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface-elevated px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Outperforming
          </p>
          <p className="mt-1 text-sm font-medium">
            {outperformingCount}/{totalStocks} vs NIFTY
          </p>
        </div>
      </div>

      {/* Strongest outlier */}
      {strongestOutlier && (
        <div className="mt-3 rounded-lg border border-border bg-surface-elevated px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Strongest outlier
              </p>
              <p className="mt-1 text-sm font-medium">
                {strongestOutlier.symbol} · {fmtPct(strongestOutlier.changePct)}
              </p>
            </div>
            {strongestOutlier.changePct >= 0 ? (
              <TrendingUp className="size-4 text-positive" />
            ) : (
              <TrendingDown className="size-4 text-negative" />
            )}
          </div>
        </div>
      )}

      {/* Noise filtered summary */}
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-3 py-2">
        <Activity className="size-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{meaningfulCount}</span> meaningful signal
          {meaningfulCount !== 1 ? "s" : ""} detected ·{" "}
          <span className="font-medium text-foreground">{noiseCount}</span> ordinary movement
          {noiseCount !== 1 ? "s" : ""} filtered from {totalStocks} stocks monitored
        </p>
      </div>
    </section>
  );
}
