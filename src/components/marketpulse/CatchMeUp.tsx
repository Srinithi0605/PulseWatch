import { Sparkles, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/market/engine";
import { cn } from "@/lib/utils";
import type { DashboardPayload } from "@/lib/marketpulse.functions";

export function CatchMeUp({
  data,
  onCheckpoint,
  saving,
}: {
  data: DashboardPayload;
  onCheckpoint: () => void;
  saving: boolean;
}) {
  const { summary, lastCheckedAt } = data;
  const rows = [
    { label: "Meaningful changes", value: String(summary.meaningfulChanges) },
    {
      label: "Biggest mover",
      value: summary.biggestMover
        ? `${summary.biggestMover.symbol} ${summary.biggestMover.changePct.toFixed(2)}%`
        : "—",
    },
    {
      label: "Best performer",
      value: summary.bestPerformer
        ? `${summary.bestPerformer.symbol} +${Math.max(0, summary.bestPerformer.changePct).toFixed(2)}%`
        : "—",
    },
    { label: "Market", value: summary.marketMove },
    {
      label: "Needs attention",
      value: summary.needsAttention.length ? summary.needsAttention.join(", ") : "Nothing urgent",
    },
  ];

  return (
    <section className="rounded-2xl border border-primary/25 bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h2 className="font-display text-lg font-semibold">Catch Me Up</h2>
          <span className="text-xs text-muted-foreground">
            {lastCheckedAt ? `since your last check ${timeAgo(lastCheckedAt)}` : "first visit — baseline saved"}
          </span>
        </div>
        <Button size="sm" variant="secondary" onClick={onCheckpoint} disabled={saving}>
          <RefreshCw className={cn("size-3.5", saving && "animate-spin")} />
          {saving ? "Saving…" : "Mark as reviewed"}
        </Button>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {rows.map((row) => (
          <div key={row.label} className="rounded-lg border border-border bg-surface-elevated px-3 py-2.5">
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{row.label}</dt>
            <dd className="mt-1 text-sm font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
