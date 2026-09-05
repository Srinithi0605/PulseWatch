import { TrendingUp, TrendingDown, Minus } from "lucide-react";

import { cn } from "@/lib/utils";
import { fmtPct } from "@/lib/market/engine";
import type { DashboardPayload } from "@/lib/marketpulse.functions";

export function MarketVsWatchlist({ data }: { data: DashboardPayload }) {
  const { watchlistPerformance } = data;

  if (!watchlistPerformance) {
    return null;
  }

  const { avgChangePct, outperformingCount, underperformingCount, niftyChangePct, interpretation } =
    watchlistPerformance;

  const watchlistColor = avgChangePct >= 0 ? "text-positive" : "text-negative";
  const niftyColor = niftyChangePct >= 0 ? "text-positive" : "text-negative";
  const diff = avgChangePct - niftyChangePct;
  const diffColor = diff >= 0 ? "text-positive" : "text-negative";

  // Calculate bar widths (normalize around 0)
  const maxAbs = Math.max(Math.abs(avgChangePct), Math.abs(niftyChangePct), 1);
  const watchlistWidth = Math.abs(avgChangePct) / maxAbs;
  const niftyWidth = Math.abs(niftyChangePct) / maxAbs;

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <TrendingUp className="size-4 text-primary" />
        <h2 className="font-display text-lg font-semibold">Market vs Your Watchlist</h2>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">{interpretation}</p>

      <div className="mt-4 space-y-3">
        {/* Watchlist bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Your watchlist (equal-weighted)</span>
            <span className={cn("tabular font-medium", watchlistColor)}>
              {fmtPct(avgChangePct)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                avgChangePct >= 0 ? "bg-positive" : "bg-negative",
              )}
              style={{ width: `${watchlistWidth * 100}%` }}
            />
          </div>
        </div>

        {/* NIFTY bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">NIFTY 50</span>
            <span className={cn("tabular font-medium", niftyColor)}>{fmtPct(niftyChangePct)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                niftyChangePct >= 0 ? "bg-positive" : "bg-negative",
              )}
              style={{ width: `${niftyWidth * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Outperformance/Underperformance breakdown */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-surface-elevated px-3 py-2">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="size-3 text-positive" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Outperforming
            </span>
          </div>
          <p className="mt-1 text-sm font-medium">{outperformingCount} stocks</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-elevated px-3 py-2">
          <div className="flex items-center gap-1.5">
            <TrendingDown className="size-3 text-negative" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Underperforming
            </span>
          </div>
          <p className="mt-1 text-sm font-medium">{underperformingCount} stocks</p>
        </div>
      </div>

      {/* Difference indicator */}
      <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-surface-elevated px-3 py-2">
        <div className="flex items-center gap-1.5">
          {Math.abs(diff) < 0.3 ? (
            <Minus className="size-3 text-muted-foreground" />
          ) : diff > 0 ? (
            <TrendingUp className="size-3 text-positive" />
          ) : (
            <TrendingDown className="size-3 text-negative" />
          )}
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Difference
          </span>
        </div>
        <span className={cn("tabular text-sm font-medium", diffColor)}>{fmtPct(diff)}</span>
      </div>
    </section>
  );
}
