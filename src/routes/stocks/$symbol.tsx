import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowLeft, CalendarClock } from "lucide-react";

import { AppShell } from "@/components/pulsewatch/MarketBar";
import { PriceChart } from "@/components/pulsewatch/PriceChart";
import { AttentionBadge, Delta, Freshness, ScoreMeter } from "@/components/pulsewatch/atoms";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fmtInr, fmtVolume, timeAgo } from "@/lib/market/engine";
import { useAuth } from "@/hooks/useAuth";
import { getStockDetail } from "@/lib/marketpulse.functions";

const RANGES = ["1D", "1W", "1M", "1Y"] as const;

export const Route = createFileRoute("/stocks/$symbol")({
  head: ({ params }) => {
    const symbol = params.symbol?.toUpperCase() ?? "Stock";
    return {
      meta: [
        { title: `${symbol} — price, attention score and signals | PulseWatch` },
        {
          name: "description",
          content: `${symbol} live demo quote, attention score, volume ratio, NIFTY-relative performance and price history on PulseWatch.`,
        },
        { property: "og:title", content: `${symbol} on PulseWatch` },
        {
          property: "og:description",
          content: `Attention score, signals and price history for ${symbol}.`,
        },
      ],
    };
  },
  component: StockDetailPage,
});

function StockDetailPage() {
  const { symbol } = Route.useParams();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [range, setRange] = useState<(typeof RANGES)[number]>("1M");
  const fetchDetail = useServerFn(getStockDetail);

  useEffect(() => {
    if (!authLoading && !session) navigate({ to: "/auth" });
  }, [authLoading, session, navigate]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["stock", symbol, range],
    queryFn: () => fetchDetail({ data: { symbol, range } }),
    enabled: Boolean(session),
    refetchInterval: 30_000,
  });

  if (isError) {
    return (
      <AppShell>
        <div className="rounded-xl border border-negative/40 bg-surface p-6 text-center">
          <AlertTriangle className="mx-auto size-5 text-negative" />
          <h1 className="mt-3 font-display text-lg font-semibold">We couldn't load {symbol}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Please try again."}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button size="sm" onClick={() => refetch()}>
              Try again
            </Button>
            <Button size="sm" variant="secondary" asChild>
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (authLoading || isLoading || !data) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </AppShell>
    );
  }

  const { insight, history, events, nifty, status } = data;
  const { quote } = insight;
  const up = quote.changePct >= 0;

  const stats = [
    { label: "Day high", value: fmtInr(quote.dayHigh) },
    { label: "Day low", value: fmtInr(quote.dayLow) },
    { label: "52-week high", value: fmtInr(quote.week52High) },
    { label: "52-week low", value: fmtInr(quote.week52Low) },
    { label: "Volume", value: fmtVolume(quote.volume) },
    { label: "Volume ratio", value: `${quote.volumeRatio.toFixed(2)}x avg` },
    {
      label: "vs NIFTY 50",
      value: `${insight.relativeToNifty >= 0 ? "+" : ""}${insight.relativeToNifty.toFixed(2)}%`,
    },
    { label: "Prev close", value: fmtInr(quote.prevClose) },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>

        <header className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-display text-2xl font-semibold tracking-tight">{quote.symbol}</h1>
                <AttentionBadge level={insight.level} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {quote.name} · {quote.exchange}
              </p>
              <div className="mt-4 flex flex-wrap items-baseline gap-4">
                <span className="tabular font-display text-3xl font-semibold">
                  {fmtInr(quote.price)}
                </span>
                <span className={cn("tabular text-sm", up ? "text-positive" : "text-negative")}>
                  {up ? "+" : ""}
                  {quote.change.toFixed(2)} <Delta value={quote.changePct} />
                </span>
                <span className="text-sm text-muted-foreground">
                  Since last check <Delta value={insight.sinceCheckPct} />
                </span>
              </div>
            </div>

            <div className="space-y-2 text-right">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Attention score
              </p>
              <ScoreMeter score={insight.attentionScore} />
              <Freshness iso={data.fetchedAt} stale={!status.isOpen} />
              {nifty && (
                <p className="tabular text-xs text-muted-foreground">
                  NIFTY 50 {nifty.changePct >= 0 ? "+" : ""}
                  {nifty.changePct.toFixed(2)}%
                </p>
              )}
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold">Price history</h2>
            <div className="flex gap-1 rounded-lg border border-border p-1">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    r === range
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <PriceChart data={history} range={range} positive={up} />
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-surface px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className="tabular mt-1 text-sm font-medium">{s.value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-base font-semibold">Why it matters</h2>
            <p className="mt-2 text-sm text-foreground/90">{insight.why}</p>
            <ul className="mt-4 space-y-2">
              {insight.signals.map((signal) => (
                <li
                  key={`${signal.kind}-${signal.label}`}
                  className="rounded-lg border border-border bg-surface-elevated px-3 py-2"
                >
                  <p
                    className={cn(
                      "text-sm font-medium",
                      signal.tone === "positive" && "text-positive",
                      signal.tone === "negative" && "text-negative",
                      signal.tone === "notable" && "text-notable",
                    )}
                  >
                    {signal.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{signal.detail}</p>
                </li>
              ))}
              {insight.signals.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  No unusual signals — this stock is trading within its normal range.
                </li>
              )}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4 text-muted-foreground" />
              <h2 className="font-display text-base font-semibold">Session timeline</h2>
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                Demo events
              </span>
            </div>
            <ol className="mt-4 space-y-3 border-l border-border pl-4">
              {events.map((event) => (
                <li key={`${event.at}-${event.title}`} className="relative">
                  <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary" />
                  <p className="text-sm font-medium">{event.title}</p>
                  <p className="text-xs text-muted-foreground">{event.detail}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(event.at)}</p>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[11px] text-muted-foreground">
              These are generated demo events derived from price and volume data — not real news.
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
