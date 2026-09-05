import { useEffect, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { fmtPct, timeAgo } from "@/lib/market/engine";
import { getAttentionScoreBreakdown } from "@/lib/market/pulse";
import type { AttentionLevel, StockInsight } from "@/lib/market/types";

const LEVEL_STYLE: Record<AttentionLevel, string> = {
  NORMAL: "bg-neutral-soft text-muted-foreground border-border",
  NOTABLE: "bg-notable-soft text-notable border-notable/30",
  SIGNIFICANT: "bg-critical-soft text-critical border-critical/30",
  CRITICAL: "bg-critical-soft text-critical border-critical/60",
};

const LEVEL_LABEL: Record<AttentionLevel, string> = {
  NORMAL: "Normal",
  NOTABLE: "Notable",
  SIGNIFICANT: "Significant",
  CRITICAL: "Critical",
};

export function AttentionBadge({
  level,
  className,
}: {
  level: AttentionLevel;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider",
        LEVEL_STYLE[level],
        className,
      )}
    >
      {LEVEL_LABEL[level]}
    </span>
  );
}

export function Delta({
  value,
  className,
  suffix,
}: {
  value: number | null;
  className?: string;
  suffix?: string;
}) {
  if (value === null) return <span className={cn("text-muted-foreground", className)}>—</span>;
  return (
    <span
      className={cn(
        "tabular font-medium",
        value > 0 ? "text-positive" : value < 0 ? "text-negative" : "text-muted-foreground",
        className,
      )}
    >
      {fmtPct(value)}
      {suffix}
    </span>
  );
}

export function ScoreMeter({ score, insight }: { score: number; insight?: StockInsight }) {
  const tone = score >= 70 ? "bg-critical" : score >= 40 ? "bg-notable" : "bg-primary";
  const breakdown = insight ? getAttentionScoreBreakdown(insight) : null;

  if (!breakdown) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", tone)}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="tabular text-xs text-muted-foreground">{score}</span>
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", tone)}
              style={{ width: `${score}%` }}
            />
          </div>
          <span className="tabular text-xs text-muted-foreground">{score}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64" side="top">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Attention Score</span>
            <span className="tabular text-sm font-bold">{breakdown.total}</span>
          </div>
          <div className="space-y-2">
            {breakdown.components.map((component) => (
              <div key={component.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{component.name}</span>
                  <span className="tabular text-muted-foreground">
                    {component.points}/{component.max}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(component.points / component.max) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">{component.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Freshness({ iso, stale }: { iso: string; stale?: boolean }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className={cn("tabular text-xs", stale ? "text-notable" : "text-muted-foreground")}>
      {stale ? "Delayed · " : "Updated "}
      {timeAgo(iso)}
    </span>
  );
}
