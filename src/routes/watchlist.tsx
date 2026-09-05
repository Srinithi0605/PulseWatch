import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Inbox } from "lucide-react";

import { AddStockDialog } from "@/components/pulsewatch/AddStockDialog";
import { AppShell } from "@/components/pulsewatch/MarketBar";
import { WatchlistTable } from "@/components/pulsewatch/WatchlistTable";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { addStock, getDashboard, removeStock } from "@/lib/marketpulse.functions";

export const Route = createFileRoute("/watchlist")({
  head: () => ({
    meta: [
      { title: "Watchlist — PulseWatch" },
      { name: "description", content: "Manage the stocks PulseWatch monitors for meaningful changes." },
    ],
  }),
  component: WatchlistPage,
});

function WatchlistPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const fetchDashboard = useServerFn(getDashboard);
  const addFn = useServerFn(addStock);
  const removeFn = useServerFn(removeStock);

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
  const symbols = data?.insights.map((i) => i.quote.symbol) ?? [];

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

  if (authLoading || isLoading || !data) {
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
        <Skeleton className="h-80 w-full rounded-xl" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Watchlist</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.insights.length} stocks monitored with live attention scoring.
            </p>
          </div>
          <AddStockDialog
            existing={symbols}
            adding={addMutation.isPending}
            onAdd={(symbol) => addMutation.mutate(symbol)}
          />
        </div>

        {actionError && (
          <p className="rounded-lg border border-negative/40 bg-surface px-3 py-2 text-sm text-negative">
            {actionError}
          </p>
        )}

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
            <Inbox className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Your watchlist is empty</p>
            <p className="mt-1 text-xs text-muted-foreground">Add a stock to start tracking changes.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
