import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ArrowDownRight, Gauge } from "lucide-react";

import { cn } from "@/lib/utils";
import { fmtInr, fmtPct } from "@/lib/market/engine";
import { AttentionBadge, ScoreMeter } from "./atoms";
import type { StockInsight } from "@/lib/market/types";

export function ChangeCard({ insight }: { insight: StockInsight }) {
  const { quote } = insight;
  const up = quote.changePct >= 0;
  return (
    <Link
      to="/stocks/$symbol"
      params={{ symbol: quote.symbol }}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/40 hover:bg-surface-elevated"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-base font-semibold">{quote.symbol}</span>
            <span
              className={cn(
                "tabular inline-flex items-center gap-0.5 text-sm font-medium",
                up ? "text-positive" : "text-negative",
              )}
            >
              {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {fmtPct(quote.changePct)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{quote.name}</p>
        </div>
        <AttentionBadge level={insight.level} />
      </div>

      <p className="text-sm text-foreground/90">{insight.headline}</p>

      <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
        <span className="tabular text-sm">{fmtInr(quote.price)}</span>
        <div className="flex items-center gap-2">
          <Gauge className="size-3.5 text-muted-foreground" />
          <ScoreMeter score={insight.attentionScore} />
        </div>
      </div>
    </Link>
  );
}
