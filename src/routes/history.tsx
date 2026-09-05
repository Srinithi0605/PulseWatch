import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Inbox, ChevronRight } from "lucide-react";

import { AppShell } from "@/components/pulsewatch/MarketBar";
import { AttentionBadge, Delta, ScoreMeter } from "@/components/pulsewatch/atoms";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fmtInr, fmtPct, timeAgo } from "@/lib/market/engine";
import { useAuth } from "@/hooks/useAuth";
import { getChangeHistory } from "@/lib/marketpulse.functions";
import type { ChangeHistoryItem } from "@/lib/marketpulse.functions";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Change History — PulseWatch" },
      { name: "description", content: "Your historical meaningful market changes." },
    ],
  }),
  component: HistoryPage,
});

type FilterType = "all" | "today" | "this_week";
type SeverityFilter = "all" | "significant" | "critical" | "unusual";

function isToday(date: string): boolean {
  const d = new Date(date);
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

function isThisWeek(date: string): boolean {
  const d = new Date(date);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return d >= weekAgo;
}

function getGroupLabel(date: string): string {
  if (isToday(date)) return "TODAY";
  const d = new Date(date);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  ) {
    return "YESTERDAY";
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function HistoryPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [filter, setFilter] = useState<FilterType>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const historyFn = useServerFn(getChangeHistory);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["change-history"],
    queryFn: () => historyFn(),
    enabled: Boolean(session),
  });

  // Filter items
  const filteredItems = data?.items.filter((item) => {
    if (filter === "today" && !isToday(item.capturedAt)) return false;
    if (filter === "this_week" && !isThisWeek(item.capturedAt)) return false;
    if (
      severityFilter === "significant" &&
      item.level !== "SIGNIFICANT" &&
      item.level !== "CRITICAL"
    )
      return false;
    if (severityFilter === "critical" && item.level !== "CRITICAL") return false;
    if (severityFilter === "unusual" && !item.signals.some((s) => s.kind === "VOLUME"))
      return false;
    return true;
  });

  // Group by date
  const groupedItems = filteredItems?.reduce(
    (acc, item) => {
      const group = getGroupLabel(item.capturedAt);
      if (!acc[group]) acc[group] = [];
      acc[group].push(item);
      return acc;
    },
    {} as Record<string, ChangeHistoryItem[]>,
  );

  if (authLoading || (!session && !data)) {
    return (
      <AppShell>
        <Skeleton className="h-72 w-full rounded-xl" />
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell>
        <div className="rounded-xl border border-negative/40 bg-surface p-6 text-center">
          <AlertTriangle className="mx-auto size-5 text-negative" />
          <h1 className="mt-3 font-display text-lg font-semibold">
            We couldn't load your change history
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Please try again."}
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Change History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything PulseWatch has flagged for you.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-border bg-surface-elevated p-1">
            {(["all", "today", "this_week"] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f === "all" ? "All" : f === "today" ? "Today" : "This Week"}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-border bg-surface-elevated p-1">
            {(["all", "significant", "critical", "unusual"] as SeverityFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setSeverityFilter(f)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  severityFilter === f
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f === "all"
                  ? "All"
                  : f === "significant"
                    ? "Significant"
                    : f === "critical"
                      ? "Critical"
                      : "Unusual"}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        {groupedItems && Object.keys(groupedItems).length > 0 ? (
          <div className="space-y-6">
            {Object.entries(groupedItems).map(([groupLabel, items]) => (
              <div key={groupLabel}>
                <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {groupLabel}
                </h3>
                <div className="space-y-3">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() =>
                        navigate({ to: "/stocks/$symbol", params: { symbol: item.symbol } })
                      }
                      className="w-full rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-elevated"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{item.symbol}</span>
                            <AttentionBadge level={item.level} />
                          </div>
                          <p className="mt-1 text-sm text-foreground/90">{item.headline}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                            <span className="tabular font-medium">{fmtInr(item.price)}</span>
                            <Delta value={item.changePct} />
                            {item.sinceCheckPct !== null && (
                              <span className="text-xs text-muted-foreground">
                                Since check: <Delta value={item.sinceCheckPct} />
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">{item.why}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {timeAgo(item.capturedAt)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <ScoreMeter score={item.attentionScore} />
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center">
            <Inbox className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No meaningful changes yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {filter !== "all" || severityFilter !== "all"
                ? "Try adjusting your filters to see more history."
                : "PulseWatch will flag meaningful market changes here as they occur."}
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
