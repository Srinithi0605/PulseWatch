import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { fmtPct, timeAgo } from "@/lib/market/engine";
import type { AttentionLevel } from "@/lib/market/types";

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

export function AttentionBadge({ level, className }: { level: AttentionLevel; className?: string }) {
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

export function ScoreMeter({ score }: { score: number }) {
  const tone = score >= 70 ? "bg-critical" : score >= 40 ? "bg-notable" : "bg-primary";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${score}%` }} />
      </div>
      <span className="tabular text-xs text-muted-foreground">{score}</span>
    </div>
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
