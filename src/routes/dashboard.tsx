import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Inbox } from "lucide-react";

import { AppShell, MarketBar } from "@/components/marketpulse/MarketBar";
import { CatchMeUp } from "@/components/marketpulse/CatchMeUp";
import { ChangeCard } from "@/components/marketpulse/ChangeCard";
import { WatchlistTable } from "@/components/marketpulse/WatchlistTable";
import { AddStockDialog } from "@/components/marketpulse/AddStockDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import {
  addStock,
  getDashboard,
  removeStock,
  saveCheckpoint,
} from "@/lib/marketpulse.functions";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — MarketPulse" },
      {
        name: "description",
        content:
          "Your watchlist ranked by attention: meaningful moves, unusual volume and change since your last check.",
      },
      { property: "og:title", content: "Dashboard — MarketPulse" },
      {
        property: "og:description",
        content: "Your Indian stock watchlist, ranked by what actually deserves your attention.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchDashboard = useServerFn(getDashboard);
  const addFn = useServerFn(addStock);
  const removeFn = useServerFn(removeStock);
  const checkpointFn = useServerFn(saveCheckpoint);

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
            <h1 className="mt-3 font-display text-lg font-semibold">We couldn't load your watchlist</h1>
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
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            What changed since your last visit?
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.isFirstVisit
              ? "First visit — we saved a baseline, so your next check will show the difference."
              : `${data.changes.length} of ${data.insights.length} stocks moved enough to matter.`}
          </p>
        </div>

        {actionError && (
          <p className="rounded-lg border border-negative/40 bg-surface px-3 py-2 text-sm text-negative">
            {actionError}
          </p>
        )}

        {data.changes.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.changes.map((insight) => (
              <ChangeCard key={insight.quote.symbol} insight={insight} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface px-4 py-8 text-center">
            <Inbox className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Nothing needs your attention right now</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Every stock in your watchlist is moving within its normal range.
            </p>
          </div>
        )}

        <CatchMeUp
          data={data}
          saving={checkpointMutation.isPending}
          onCheckpoint={() => checkpointMutation.mutate()}
        />

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
