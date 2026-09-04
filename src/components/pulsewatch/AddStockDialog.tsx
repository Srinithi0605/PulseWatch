import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

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
import { searchUniverse } from "@/lib/market/universe";

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
  const results = useMemo(() => searchUniverse(term), [term]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Add stock
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a stock to your watchlist</DialogTitle>
          <DialogDescription>Search NSE symbols supported by PulseWatch.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search RELIANCE, TCS, Infosys…"
            className="pl-9"
          />
        </div>

        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {results.length === 0 && (
            <li className="px-2 py-6 text-center text-sm text-muted-foreground">
              No stocks match “{term}”.
            </li>
          )}
          {results.map((stock) => {
            const already = existing.includes(stock.symbol);
            return (
              <li
                key={stock.symbol}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{stock.symbol}</p>
                  <p className="text-xs text-muted-foreground">
                    {stock.name} · {stock.sector}
                  </p>
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
                >
                  {already ? "Added" : "Add"}
                </Button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
