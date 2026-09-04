import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Bell, Gauge, LineChart } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MarketPulse — What changed in your Indian stocks?" },
      {
        name: "description",
        content:
          "MarketPulse is an attention layer on the Indian market: it tells you what meaningfully changed in your watchlist since you last checked.",
      },
      { property: "og:title", content: "MarketPulse — What changed in your Indian stocks?" },
      {
        property: "og:description",
        content:
          "An attention layer on the Indian market. See meaningful moves, unusual volume and relative performance at a glance.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Gauge,
    title: "Attention Score",
    body: "Every stock gets a 0–100 score built from move size, volume, relative strength and range breaks.",
  },
  {
    icon: Bell,
    title: "Since your last check",
    body: "We snapshot the market when you leave, then show exactly what shifted when you return.",
  },
  {
    icon: LineChart,
    title: "Context, not noise",
    body: "1D to 1Y charts, 52-week range, volume ratio and NIFTY-relative performance on every stock.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Activity className="size-4" />
            </span>
            <span className="font-display text-base font-semibold tracking-tight">MarketPulse</span>
          </div>
          <Link
            to="/auth"
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-elevated"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4">
        <section className="py-20 text-center">
          <span className="inline-flex items-center rounded-full border border-border px-3 py-1 text-[11px] uppercase tracking-widest text-muted-foreground">
            Demo market data
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-6xl">
            What meaningfully changed since you last checked?
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground">
            Not another watchlist. MarketPulse is a personalized attention layer over Indian stocks —
            it ranks your holdings by how much they actually deserve your time right now.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/dashboard"
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Open dashboard
            </Link>
            <Link
              to="/auth"
              className="rounded-md border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-surface-elevated"
            >
              Create an account
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-24 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-surface p-5">
              <f.icon className="size-5 text-primary" />
              <h2 className="mt-3 font-display text-base font-semibold">{f.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
