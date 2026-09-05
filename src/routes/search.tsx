import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, ArrowUpRight, Check, Plus, Search as SearchIcon } from "lucide-react";

import { AppShell } from "@/components/pulsewatch/MarketBar";
import { Delta } from "@/components/pulsewatch/atoms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { fmtInr } from "@/lib/market/engine";
import { addStock, getDashboard, searchStocks } from "@/lib/marketpulse.functions";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search Stocks — PulseWatch" },
      {
        name: "description",
        content: "Search live Indian NSE & BSE stocks, view prices, and add them to PulseWatch.",
      },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const [term, setTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const searchFn = useServerFn(searchStocks);
  const fetchDashboard = useServerFn(getDashboard);
  const addFn = useServerFn(addStock);

  // 300ms debounce on search term
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(term), 300);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    if (!authLoading && !session) navigate({ to: "/auth" });
  }, [authLoading, session, navigate]);

  const { data: dashboard } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard(),
    enabled: Boolean(session),
  });

  const {
    data: results,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["stock-search", debouncedTerm],
    queryFn: () => searchFn({ data: { q: debouncedTerm } }),
    enabled: Boolean(session),
    staleTime: 15_000,
  });

  const existing = new Set(dashboard?.insights.map((i) => i.quote.symbol) ?? []);

  const addMutation = useMutation({
    mutationFn: (symbol: string) => addFn({ data: { symbol } }),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: unknown) =>
      setActionError(err instanceof Error ? err.message : "Could not add that stock"),
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Search Markets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search any Indian NSE/BSE listed stock or company to view live quotes and track in your
            watchlist.
          </p>
        </div>

        <div className="relative max-w-xl">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search Reliance, TCS, Infosys, Wipro, Tata Power, HDFC..."
            className="pl-9 text-sm"
          />
        </div>

        {actionError && (
          <div className="flex items-center gap-2 rounded-lg border border-negative/40 bg-surface px-4 py-3 text-sm text-negative">
            <AlertCircle className="size-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-negative/40 bg-surface p-6 text-center">
            <AlertCircle className="mx-auto size-6 text-negative" />
            <h3 className="mt-2 font-display text-base font-semibold">Search failed</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Could not complete search."}
            </p>
            <Button size="sm" className="mt-4" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : (results ?? []).length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <p className="font-display text-base font-medium">No results found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No matching stocks found for “{debouncedTerm}”. Try searching by ticker symbol (e.g.
              TATAPOWER, WIPRO, RELIANCE) or company name.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(results ?? []).map((stock) => {
              const added = existing.has(stock.symbol);
              return (
                <div
                  key={stock.symbol}
                  className="group relative flex flex-col justify-between rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border/80 hover:bg-surface/80"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          to="/stocks/$symbol"
                          params={{ symbol: stock.symbol }}
                          className="font-display text-lg font-bold hover:underline"
                        >
                          {stock.symbol}
                        </Link>
                        <span className="ml-2 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          {stock.exchange}
                        </span>
                      </div>
                      <Link
                        to="/stocks/$symbol"
                        params={{ symbol: stock.symbol }}
                        className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                        title="View detail page"
                      >
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </div>

                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{stock.name}</p>

                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="font-display text-lg font-semibold">
                        {fmtInr(stock.price)}
                      </span>
                      <Delta value={stock.changePct} />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {stock.source === "live" ? "Live" : "Delayed"}
                    </span>
                    <Button
                      size="sm"
                      variant={added ? "ghost" : "secondary"}
                      disabled={added || addMutation.isPending}
                      onClick={() => addMutation.mutate(stock.symbol)}
                      className="gap-1.5 text-xs"
                    >
                      {added ? (
                        <>
                          <Check className="size-3.5" /> Added
                        </>
                      ) : (
                        <>
                          <Plus className="size-3.5" /> Add to watchlist
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
