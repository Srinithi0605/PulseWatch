import { Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";

import { cn } from "@/lib/utils";
import { fmtPct } from "@/lib/market/engine";
import { Freshness } from "./atoms";
import type { IndexQuote, MarketStatus } from "@/lib/market/types";

export function MarketBar({
  status,
  indices,
  fetchedAt,
  source,
}: {
  status: MarketStatus;
  indices: IndexQuote[];
  fetchedAt: string;
  source: "demo" | "live";
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "size-2 rounded-full",
            status.isOpen ? "bg-positive animate-pulse" : "bg-muted-foreground",
          )}
        />
        <span className="text-sm font-medium">{status.label}</span>
      </div>

      {indices.map((idx) => (
        <div key={idx.symbol} className="flex items-baseline gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">{idx.name}</span>
          <span className="tabular text-sm font-semibold">
            {idx.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </span>
          <span
            className={cn(
              "tabular text-xs",
              idx.changePct >= 0 ? "text-positive" : "text-negative",
            )}
          >
            {fmtPct(idx.changePct)}
          </span>
        </div>
      ))}

      <div className="ml-auto flex items-center gap-3">
        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          <Activity className="size-3" />
          {source === "demo" ? "Demo data" : "Live data"}
        </span>
        <Freshness iso={fetchedAt} stale={!status.isOpen} />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Activity className="size-4" />
            </span>
            <span className="font-display text-base font-semibold tracking-tight">MarketPulse</span>
          </Link>
          <span className="hidden text-xs text-muted-foreground sm:block">
            Your attention layer on the Indian market
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
