import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Inbox, ChevronRight, Info } from "lucide-react";

import { AppShell, MarketBar } from "@/components/pulsewatch/MarketBar";
import { CatchMeUp } from "@/components/pulsewatch/CatchMeUp";
import { ChangeCard } from "@/components/pulsewatch/ChangeCard";
import { WatchlistTable } from "@/components/pulsewatch/WatchlistTable";
import { AddStockDialog } from "@/components/pulsewatch/AddStockDialog";
import { MarketVsWatchlist } from "@/components/pulsewatch/MarketVsWatchlist";
import { MarketBrief } from "@/components/pulsewatch/MarketBrief";
import { TodaysPulse } from "@/components/pulsewatch/TodaysPulse";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  addStock,
  getDashboard,
  removeStock,
  saveCheckpoint,
  resetDemoCheckpoint,
} from "@/lib/marketpulse.functions";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — PulseWatch" },
      {
        name: "description",
        content:
          "Your watchlist ranked by attention: meaningful moves, unusual volume and change since your last check.",
      },
      { property: "og:title", content: "Dashboard — PulseWatch" },
      {
        property: "og:description",
        content: "Your Indian stock watchlist, ranked by what actually deserves your attention.",
      },
    ],
  }),
  component: DashboardPage,
});

/** Formats ms elapsed since `iso` as "4h 32m", "45m", "2h", etc. */
function awayTime(iso: string): string {
  const totalMins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function DashboardPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);

  const fetchDashboard = useServerFn(getDashboard);
  const addFn = useServerFn(addStock);
  const removeFn = useServerFn(removeStock);
  const checkpointFn = useServerFn(saveCheckpoint);
  const resetDemoFn = useServerFn(resetDemoCheckpoint);

  useEffect(() => {
    if (!authLoading && !session) navigate({ to: "/auth" });
  }, [authLoading, session, navigate]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard(),
    enabled: Boolean(session),
    refetchInterval: 30_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["dashboard"] });

  const addMutation = useMutation({
    mutationFn: (symbol: string) => addFn({ data: { symbol } }),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (err: unknown) =>
      setActionError(err instanceof Error ? err.message : "Could not add that stock"),
  });

  const removeMutation = useMutation({
    mutationFn: (symbol: string) => removeFn({ data: { symbol } }),
    onSettled: () => setRemoving(null),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (err: unknown) =>
      setActionError(err instanceof Error ? err.message : "Could not remove that stock"),
  });

  const checkpointMutation = useMutation({
    mutationFn: () => checkpointFn(),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (err: unknown) =>
      setActionError(err instanceof Error ? err.message : "Could not save your checkpoint"),
  });

  const resetDemoMutation = useMutation({
    mutationFn: () => resetDemoFn(),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (err: unknown) =>
      setActionError(err instanceof Error ? err.message : "Could not reset demo"),
  });

  if (authLoading || (!session && !data)) {
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

  if (isLoading || !data) {
    if (isError) {
      return (
        <AppShell>
          <div className="rounded-xl border border-negative/40 bg-surface p-6 text-center">
            <AlertTriangle className="mx-auto size-5 text-negative" />
            <h1 className="mt-3 font-display text-lg font-semibold">
              We couldn't load your watchlist
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Please try again."}
            </p>
            <Button className="mt-4" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        </AppShell>
      );
    }
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

  const symbols = data.insights.map((i) => i.quote.symbol);

  return (
    <AppShell>
      <div className="space-y-6">
        <MarketBar
          status={data.status}
          indices={data.indices}
          fetchedAt={data.fetchedAt}
          source={data.dataSource}
        />

        <div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {data.displayName ? `Welcome back, ${data.displayName}!` : "Welcome back!"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.lastCheckedAt
                  ? `You were away for ${awayTime(data.lastCheckedAt)} · ${data.changes.length} of ${data.insights.length} stocks moved enough to matter.`
                  : `${data.changes.length} of ${data.insights.length} stocks moved enough to matter.`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/history" })}
              className="text-primary"
            >
              View all changes
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </div>

        <TodaysPulse data={data} />

        <CatchMeUp
          data={data}
          saving={checkpointMutation.isPending}
          onCheckpoint={() => checkpointMutation.mutate()}
          onResetDemo={() => resetDemoMutation.mutate()}
          resetting={resetDemoMutation.isPending}
          onOpenBrief={() => setBriefOpen(true)}
        />

        <div className="flex items-center justify-end">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <Info className="mr-1 size-4" />
                What do these metrics mean?
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Understanding Today's Pulse</DialogTitle>
                <DialogDescription>
                  Key metrics that help you understand your watchlist's performance relative to the market.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium">Market</h4>
                  <p className="mt-1 text-muted-foreground">
                    The NIFTY 50 index's percentage change today. This represents the broader Indian market's movement.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Your watchlist</h4>
                  <p className="mt-1 text-muted-foreground">
                    The equal-weighted average percentage change of all stocks in your watchlist. This shows how your
                    holdings are performing as a group.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Outperformance</h4>
                  <p className="mt-1 text-muted-foreground">
                    The difference between your watchlist's average change and NIFTY's change. Positive means your
                    watchlist is beating the market; negative means it's lagging.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Outperforming</h4>
                  <p className="mt-1 text-muted-foreground">
                    The count of stocks in your watchlist that are performing better than NIFTY today, shown as a ratio
                    of your total watchlist size.
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <MarketBrief
          open={briefOpen}
          onOpenChange={setBriefOpen}
          data={data ?? null}
          onReviewChanges={() => {
            setBriefOpen(false);
            document.getElementById("changes-section")?.scrollIntoView({ behavior: "smooth" });
          }}
          onMarkReviewed={() => checkpointMutation.mutate()}
          markingReviewed={checkpointMutation.isPending}
        />

        {actionError && (
          <p className="rounded-lg border border-negative/40 bg-surface px-3 py-2 text-sm text-negative">
            {actionError}
          </p>
        )}

        <div id="changes-section">
          {data.changes.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.changes.map((insight) => (
                <ChangeCard key={insight.quote.symbol} insight={insight} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface px-4 py-8 text-center">
              <Inbox className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No meaningful changes yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                PulseWatch will flag meaningful market changes here as they occur.
              </p>
            </div>
          )}
        </div>

        <MarketVsWatchlist data={data} />

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">{data.watchlistName}</h2>
            <AddStockDialog
              existing={symbols}
              adding={addMutation.isPending}
              onAdd={(symbol) => addMutation.mutate(symbol)}
            />
          </div>

          {data.insights.length ? (
            <WatchlistTable
              insights={data.insights}
              removing={removing}
              onRemove={(symbol) => {
                setRemoving(symbol);
                removeMutation.mutate(symbol);
              }}
            />
          ) : (
            <div className="rounded-xl border border-border bg-surface px-4 py-10 text-center">
              <p className="text-sm font-medium">Your watchlist is empty</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add a stock to start tracking meaningful changes.
              </p>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
