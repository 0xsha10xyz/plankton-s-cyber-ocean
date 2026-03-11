import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type TokenOption = { symbol: string; mint: string; decimals: number };

type TokenSelectProps = {
  value: TokenOption;
  options: TokenOption[];
  onSelect: (token: TokenOption) => void;
  resolveCa: (ca: string) => Promise<TokenOption | null>;
  getBalance: (token: TokenOption) => number;
  disabled?: boolean;
};

export function TokenSelect({
  value,
  options,
  onSelect,
  resolveCa,
  getBalance,
  disabled,
}: TokenSelectProps) {
  const [open, setOpen] = useState(false);
  const [pasteCa, setPasteCa] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePasteSubmit = async () => {
    const ca = pasteCa.trim();
    if (!ca || ca.length < 32) return;
    setLoading(true);
    try {
      const token = await resolveCa(ca);
      if (token) {
        onSelect(token);
        setPasteCa("");
        setOpen(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-10 min-w-[7rem] max-w-[12rem] justify-between gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium",
            "hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <span className="truncate">{value.symbol}</span>
          <ChevronDown size={14} className="shrink-0 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-2 border-b border-border/50">
          <p className="text-xs text-muted-foreground mb-1.5">Paste token CA → nama muncul otomatis</p>
          <div className="flex gap-1.5">
            <Input
              placeholder="Contract address..."
              value={pasteCa}
              onChange={(e) => setPasteCa(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePasteSubmit()}
              className="h-8 text-xs font-mono flex-1"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 shrink-0"
              onClick={handlePasteSubmit}
              disabled={loading || pasteCa.trim().length < 32}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : "OK"}
            </Button>
          </div>
        </div>
        <ScrollArea className="max-h-56">
          <div className="p-1">
            {options.map((t) => (
              <button
                type="button"
                key={t.mint}
                onClick={() => {
                  onSelect(t);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between rounded-md px-2 py-2 text-left text-sm transition-colors",
                  "hover:bg-accent/50 focus:bg-accent/50",
                  t.mint === value.mint && "bg-primary/15 text-primary"
                )}
              >
                <span className="font-medium truncate">{t.symbol}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {getBalance(t).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
