import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AttentionBadge, Delta, ScoreMeter } from "@/components/pulsewatch/atoms";
import { cn } from "@/lib/utils";
import { fmtInr, fmtPct, timeAgo } from "@/lib/market/engine";
import type { DashboardPayload } from "@/lib/marketpulse.functions";
import type { StockInsight } from "@/lib/market/types";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Volume2,
  ArrowRight,
} from "lucide-react";

interface PriorityItem {
  type:
    | "biggest_mover"
    | "best_performer"
    | "outperforming"
    | "underperforming"
    | "unusual_volume"
    | "critical";
  insight: StockInsight;
  label: string;
  icon: React.ReactNode;
  tone: "positive" | "negative" | "notable" | "critical";
}

function MarketBriefContent({
  data,
  onReviewChanges,
  onMarkReviewed,
  markingReviewed,
}: {
  data: DashboardPayload;
  onReviewChanges: () => void;
  onMarkReviewed: () => void;
  markingReviewed: boolean;
}) {
  const { summary, lastCheckedAt, insights, changes, watchlistPerformance, indices } = data;

  // Calculate priority items (3-5 highest priority)
  const priorityItems: PriorityItem[] = [];

  // 1. Critical/SIGNIFICANT items (highest priority)
  const criticalItems = changes.filter((i) => i.level === "CRITICAL" || i.level === "SIGNIFICANT");
  criticalItems.slice(0, 2).forEach((insight) => {
    priorityItems.push({
      type: "critical",
      insight,
      label: insight.level === "CRITICAL" ? "Critical movement" : "Significant movement",
      icon: <AlertTriangle className="size-4" />,
      tone: insight.level === "CRITICAL" ? "critical" : "notable",
    });
  });

  // 2. Biggest mover (if not already included)
  if (summary.biggestMover) {
    const biggestMover = insights.find((i) => i.quote.symbol === summary.biggestMover?.symbol);
    if (
      biggestMover &&
      !priorityItems.some((p) => p.insight.quote.symbol === biggestMover.quote.symbol)
    ) {
      priorityItems.push({
        type: "biggest_mover",
        insight: biggestMover,
        label: "Biggest mover",
        icon: <TrendingUp className="size-4" />,
        tone: Math.abs(biggestMover.quote.changePct) >= 2 ? "critical" : "notable",
      });
    }
  }

  // 3. Best performer (if not already included)
  if (summary.bestPerformer) {
    const bestPerformer = insights.find((i) => i.quote.symbol === summary.bestPerformer?.symbol);
    if (
      bestPerformer &&
      !priorityItems.some((p) => p.insight.quote.symbol === bestPerformer.quote.symbol)
    ) {
      priorityItems.push({
        type: "best_performer",
        insight: bestPerformer,
        label: "Best performer",
        icon: <TrendingUp className="size-4" />,
        tone: "positive",
      });
    }
  }

  // 4. Unusual volume (if not already included)
  const unusualVolume = insights.filter((i) => i.signals.some((s) => s.kind === "VOLUME"));
  unusualVolume.slice(0, 1).forEach((insight) => {
    if (!priorityItems.some((p) => p.insight.quote.symbol === insight.quote.symbol)) {
      priorityItems.push({
        type: "unusual_volume",
        insight,
        label: "Unusual volume",
        icon: <Volume2 className="size-4" />,
        tone: "notable",
      });
    }
  });

  // 5. Outperforming/underperforming NIFTY (if watchlist performance exists)
  if (watchlistPerformance) {
    const outperforming = insights
      .filter((i) => i.quote.changePct > watchlistPerformance.niftyChangePct)
      .sort((a, b) => b.quote.changePct - a.quote.changePct)[0];
    if (
      outperforming &&
      !priorityItems.some((p) => p.insight.quote.symbol === outperforming.quote.symbol)
    ) {
      priorityItems.push({
        type: "outperforming",
        insight: outperforming,
        label: "Outperforming NIFTY",
        icon: <TrendingUp className="size-4" />,
        tone: "positive",
      });
    }
  }

  // Limit to 5 items
  const topItems = priorityItems.slice(0, 5);

  // Calculate filtered noise
  const normalStocks = insights.filter((i) => i.level === "NORMAL" && i.signals.length === 0);
  const noiseCount = normalStocks.length;

  // Get NIFTY from indices
  const nifty = indices.find((i) => i.symbol === "NIFTY 50");

  return (
    <div className="space-y-6">
      {/* Header summary */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {lastCheckedAt ? `You were away for ${timeAgo(lastCheckedAt)}` : "Setting baseline…"}
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {summary.meaningfulChanges} meaningful change
              {summary.meaningfulChanges !== 1 ? "s" : ""}
            </p>
          </div>
          {noiseCount > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Filtered noise</p>
              <p className="text-sm font-medium">{noiseCount} stocks with no change</p>
            </div>
          )}
        </div>
      </div>

      {/* Market summary */}
      <div className="rounded-xl border border-border bg-surface-elevated p-4">
        <h3 className="mb-3 text-sm font-semibold">Market Summary</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">NIFTY 50</p>
            <p
              className={cn(
                "text-sm font-medium",
                nifty?.changePct && nifty.changePct >= 0 ? "text-positive" : "text-negative",
              )}
            >
              {nifty ? fmtPct(nifty.changePct) : "—"}
            </p>
          </div>
          {watchlistPerformance && (
            <div>
              <p className="text-xs text-muted-foreground">Your watchlist (equal-weighted)</p>
              <p
                className={cn(
                  "text-sm font-medium",
                  watchlistPerformance.avgChangePct >= 0 ? "text-positive" : "text-negative",
                )}
              >
                {fmtPct(watchlistPerformance.avgChangePct)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Priority items */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Top priorities</h3>
        {topItems.length > 0 ? (
          <div className="space-y-3">
            {topItems.map((item, idx) => (
              <div
                key={`${item.type}-${item.insight.quote.symbol}`}
                className="rounded-lg border border-border bg-surface-elevated p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "mt-0.5 rounded-md p-1.5",
                        item.tone === "critical" && "bg-critical-soft text-critical",
                        item.tone === "notable" && "bg-notable-soft text-notable",
                        item.tone === "positive" && "bg-positive/10 text-positive",
                        item.tone === "negative" && "bg-negative/10 text-negative",
                      )}
                    >
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.insight.quote.symbol}</span>
                        <AttentionBadge level={item.insight.level} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="tabular text-sm font-medium">
                          {fmtInr(item.insight.quote.price)}
                        </span>
                        <Delta value={item.insight.quote.changePct} />
                        {item.insight.sinceCheckPct !== null && (
                          <span className="text-xs text-muted-foreground">
                            Since check: <Delta value={item.insight.sinceCheckPct} />
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{item.insight.why}</p>
                    </div>
                  </div>
                  <ScoreMeter score={item.insight.attentionScore} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-surface-elevated p-4 text-center">
            <p className="text-sm text-muted-foreground">No priority items to review</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onReviewChanges}>
          View all changes
          <ArrowRight className="ml-2 size-4" />
        </Button>
        <Button className="flex-1" onClick={onMarkReviewed} disabled={markingReviewed}>
          <Sparkles className="mr-2 size-4" />
          {markingReviewed ? "Marking…" : "Mark as reviewed"}
        </Button>
      </div>
    </div>
  );
}

export function MarketBrief({
  open,
  onOpenChange,
  data,
  onReviewChanges,
  onMarkReviewed,
  markingReviewed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DashboardPayload | null;
  onReviewChanges: () => void;
  onMarkReviewed: () => void;
  markingReviewed: boolean;
}) {
  if (!data) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              Your Market Brief
            </DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Loading market data…</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Your Market Brief
          </DialogTitle>
          <DialogDescription>
            Personalized briefing based on your last checkpoint and current market state
          </DialogDescription>
        </DialogHeader>
        <MarketBriefContent
          data={data}
          onReviewChanges={onReviewChanges}
          onMarkReviewed={onMarkReviewed}
          markingReviewed={markingReviewed}
        />
      </DialogContent>
    </Dialog>
  );
}
