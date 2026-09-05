import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Plus, Search } from "lucide-react";

import { Delta } from "@/components/pulsewatch/atoms";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtInr } from "@/lib/market/engine";
import { searchStocks } from "@/lib/marketpulse.functions";

export function AddStockDialog({
  existing,
  onAdd,
  adding,
}: {
  existing: string[];
  onAdd: (symbol: string) => void;
  adding: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const searchFn = useServerFn(searchStocks);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(term), 300);
    return () => clearTimeout(timer);
  }, [term]);

  const { data: results, isLoading } = useQuery({
    queryKey: ["dialog-stock-search", debouncedTerm],
    queryFn: () => searchFn({ data: { q: debouncedTerm } }),
    enabled: open,
    staleTime: 15_000,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Add stock
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a stock to your watchlist</DialogTitle>
          <DialogDescription>Search any Indian NSE/BSE stock by name or symbol.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search Reliance, TCS, Wipro, Tata Power..."
            className="pl-9"
          />
        </div>

        <ul className="max-h-80 space-y-2 overflow-y-auto">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="rounded-lg border border-border p-3">
                <Skeleton className="h-10 w-full" />
              </li>
            ))
          ) : (results ?? []).length === 0 ? (
            <li className="px-2 py-6 text-center text-sm text-muted-foreground">
              No stocks match “{debouncedTerm}”.
            </li>
          ) : (
            (results ?? []).map((stock) => {
              const already = existing.includes(stock.symbol);
              return (
                <li
                  key={stock.symbol}
                  className="flex items-center justify-between rounded-lg border border-border px-3.5 py-2.5 transition-colors hover:border-border/80 hover:bg-surface-muted/50"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2">
                      <p className="font-display text-sm font-semibold">{stock.symbol}</p>
                      <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {stock.exchange}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{stock.name}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <span className="font-medium">{fmtInr(stock.price)}</span>
                      <Delta value={stock.changePct} />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={already ? "ghost" : "secondary"}
                    disabled={already || adding}
                    onClick={() => {
                      onAdd(stock.symbol);
                      setOpen(false);
                      setTerm("");
                    }}
                    className="shrink-0 gap-1 text-xs"
                  >
                    {already ? (
                      <>
                        <Check className="size-3" /> Added
                      </>
                    ) : (
                      <>
                        <Plus className="size-3" /> Add
                      </>
                    )}
                  </Button>
                </li>
              );
            })
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
