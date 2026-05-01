import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { mintValidationMessage } from "@/lib/solana-mint";

export type TokenOption = { symbol: string; mint: string; decimals: number };

type TokenSelectProps = {
  value: TokenOption;
  options: TokenOption[];
  onSelect: (token: TokenOption) => void;
  resolveCa: (ca: string) => Promise<TokenOption | null>;
  getBalance: (token: TokenOption) => number;
  /** Resolved symbol by mint (e.g. from TokenSymbolContext). When provided, used for display instead of option.symbol. */
  getSymbol?: (mint: string) => string;
  disabled?: boolean;
};

export function TokenSelect({
  value,
  options,
  onSelect,
  resolveCa,
  getBalance,
  getSymbol,
  disabled,
}: TokenSelectProps) {
  const [open, setOpen] = useState(false);
  const displaySymbol = (t: TokenOption) => (getSymbol ? getSymbol(t.mint) : t.symbol);
  const [pasteCa, setPasteCa] = useState("");
  const [loading, setLoading] = useState(false);
  const [pasteHint, setPasteHint] = useState<string | null>(null);

  const handlePasteSubmit = async () => {
    const ca = pasteCa.trim();
    if (!ca) return;
    const msg = mintValidationMessage(ca);
    if (msg) {
      setPasteHint(msg);
      return;
    }
    setPasteHint(null);
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
          <span className="truncate">{displaySymbol(value)}</span>
          <ChevronDown size={14} className="shrink-0 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-2 border-b border-border/50">
          <p className="text-xs text-muted-foreground mb-1.5">
            Paste the full Solana mint (32–44 characters). The name resolves automatically.
          </p>
          <div className="flex gap-1.5">
            <Input
              placeholder="Full contract address (mint)…"
              value={pasteCa}
              onChange={(e) => {
                setPasteCa(e.target.value);
                setPasteHint(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handlePasteSubmit()}
              className="h-8 text-xs font-mono flex-1"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 shrink-0"
              onClick={handlePasteSubmit}
              disabled={loading || !pasteCa.trim()}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : "OK"}
            </Button>
          </div>
          {pasteHint && <p className="text-xs text-destructive mt-1.5 px-0.5">{pasteHint}</p>}
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
                <span className="font-medium truncate">{displaySymbol(t)}</span>
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
