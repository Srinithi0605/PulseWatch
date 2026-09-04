import { Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmtInr, timeAgo } from "@/lib/market/engine";
import { AttentionBadge, Delta, ScoreMeter } from "./atoms";
import type { StockInsight } from "@/lib/market/types";

export function WatchlistTable({
  insights,
  onRemove,
  removing,
}: {
  insights: StockInsight[];
  onRemove: (symbol: string) => void;
  removing: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="hidden grid-cols-[1.6fr_1fr_0.9fr_1fr_1fr_0.6fr] gap-3 border-b border-border px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground md:grid">
        <span>Stock</span>
        <span className="text-right">Price</span>
        <span className="text-right">Today</span>
        <span className="text-right">Since last check</span>
        <span>Attention</span>
        <span />
      </div>

      <ul className="divide-y divide-border">
        {insights.map((insight) => (
          <li
            key={insight.quote.symbol}
            className="grid grid-cols-2 items-center gap-3 px-4 py-3 md:grid-cols-[1.6fr_1fr_0.9fr_1fr_1fr_0.6fr]"
          >
            <div className="col-span-2 md:col-span-1">
              <Link
                to="/stocks/$symbol"
                params={{ symbol: insight.quote.symbol }}
                className="font-display text-sm font-semibold hover:text-primary"
              >
                {insight.quote.symbol}
              </Link>
              <p className="truncate text-xs text-muted-foreground">{insight.quote.name}</p>
            </div>

            <span className="tabular text-sm md:text-right">{fmtInr(insight.quote.price)}</span>
            <span className="text-right text-sm">
              <Delta value={insight.quote.changePct} />
            </span>
            <span className="text-right text-sm">
              <Delta value={insight.sinceCheckPct} />
            </span>

            <div className="col-span-2 flex items-center gap-3 md:col-span-1">
              <AttentionBadge level={insight.level} />
              <ScoreMeter score={insight.attentionScore} />
            </div>

            <div className="col-span-2 flex items-center justify-between gap-2 md:col-span-1 md:justify-end">
              <span className={cn("text-[11px] text-muted-foreground md:hidden")}>
                {timeAgo(insight.quote.updatedAt)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${insight.quote.symbol}`}
                disabled={removing === insight.quote.symbol}
                onClick={() => onRemove(insight.quote.symbol)}
              >
                <Trash2 className="size-4 text-muted-foreground" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
