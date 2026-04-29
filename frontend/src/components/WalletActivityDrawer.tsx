import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy } from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Drawer, DrawerContent } from "@/components/ui/drawer";

type WalletBalances = {
  sol: number;
  tokens: Array<{ mint: string; decimals: number; rawAmount: string }>;
};

type RpcSig = { signature: string; blockTime?: number | null; err?: unknown };

function parseWalletParam(p: string | null) {
  if (!p) return null;
  const s = p.trim();
  if (!s) return null;
  return s;
}

function shortAddr(a: string) {
  if (a.length <= 12) return a;
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

function rawToUi(rawAmount: string, decimals: number) {
  const raw = Number(rawAmount);
  if (!Number.isFinite(raw)) return 0;
  return raw / 10 ** decimals;
}

export function WalletActivityDrawer() {
  const [params, setParams] = useSearchParams();
  const address = parseWalletParam(params.get("wallet"));
  const isMobile = useIsMobile();
  const open = !!address;
  const openedScrollY = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!open) return;
    openedScrollY.current = window.scrollY;
    return undefined;
  }, [open]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        const next = new URLSearchParams(params);
        next.delete("wallet");
        setParams(next, { replace: true });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, params, setParams]);

  const close = React.useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete("wallet");
    setParams(next, { replace: true });
    const y = openedScrollY.current;
    if (typeof y === "number") {
      requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "auto" }));
    }
  }, [params, setParams]);

  const balancesQ = useQuery({
    queryKey: ["wallet", "balances", address],
    enabled: !!address,
    queryFn: async (): Promise<WalletBalances> => {
      const res = await fetch(`/api/wallet/balances?wallet=${encodeURIComponent(address!)}`);
      if (!res.ok) throw new Error("Failed to load wallet balances");
      return res.json();
    },
  });

  const sigsQ = useQuery({
    queryKey: ["wallet", "recent-sigs", address],
    enabled: !!address,
    queryFn: async (): Promise<RpcSig[]> => {
      const payload = {
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress",
        params: [address, { limit: 10 }],
      };
      const res = await fetch("/api/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as { result?: unknown };
      const resultUnknown = json.result;
      const arr: unknown[] = Array.isArray(resultUnknown) ? resultUnknown : [];
      return arr
        .map((x) => ({
          signature:
            typeof x === "object" && x !== null && "signature" in x && typeof (x as { signature?: unknown }).signature === "string"
              ? (x as { signature: string }).signature
              : "",
          blockTime:
            typeof x === "object" && x !== null && "blockTime" in x && typeof (x as { blockTime?: unknown }).blockTime === "number"
              ? (x as { blockTime: number }).blockTime
              : null,
          err: typeof x === "object" && x !== null && "err" in x ? (x as { err?: unknown }).err : null,
        }))
        .filter((x) => x.signature);
    },
  });

  const copy = React.useCallback(async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      // ignore
    }
  }, [address]);

  const Content = (
    <div className="h-full overflow-y-auto pr-1">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={close} className="gap-2">
          <ArrowLeft size={16} />
          ← Back
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Copy address" onClick={copy}>
            <Copy size={16} />
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-sm font-semibold text-foreground">Wallet</div>
        <div className="mt-1 font-mono text-xs text-muted-foreground break-all">{address ?? "—"}</div>
      </div>

      {balancesQ.isLoading && (
        <div className="rounded-lg border border-border/50 bg-secondary/30 p-4 text-sm text-muted-foreground">
          Loading balances…
        </div>
      )}

      {balancesQ.isError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Unable to load wallet balances.
        </div>
      )}

      {balancesQ.data && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
              <div className="text-[11px] text-muted-foreground">SOL balance (lamports)</div>
              <div className="mt-1 font-mono font-semibold text-foreground">
                {Math.round(balancesQ.data.sol).toLocaleString("en-US")}
              </div>
            </div>
            <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
              <div className="text-[11px] text-muted-foreground">Token accounts</div>
              <div className="mt-1 font-mono font-semibold text-foreground">
                {balancesQ.data.tokens.length.toLocaleString("en-US")}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
            <div className="text-sm font-semibold text-foreground mb-3">Top tokens</div>
            <div className="space-y-2">
              {[...balancesQ.data.tokens]
                .map((t) => ({ ...t, ui: rawToUi(t.rawAmount, t.decimals) }))
                .sort((a, b) => b.ui - a.ui)
                .slice(0, 8)
                .map((t) => (
                  <div key={t.mint} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-sm text-foreground">{shortAddr(t.mint)}</div>
                      <div className="text-xs text-muted-foreground">{t.decimals} decimals</div>
                    </div>
                    <div className={cn("shrink-0 font-mono text-sm text-foreground")}>
                      {t.ui.toLocaleString("en-US", { maximumFractionDigits: 6 })}
                    </div>
                  </div>
                ))}
              {balancesQ.data.tokens.length === 0 && (
                <div className="text-xs text-muted-foreground">No SPL tokens found.</div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-secondary/20 p-4 mt-4">
            <div className="text-sm font-semibold text-foreground mb-3">Recent transactions</div>
            {sigsQ.isLoading ? (
              <div className="text-xs text-muted-foreground">Loading recent tx…</div>
            ) : sigsQ.data && sigsQ.data.length > 0 ? (
              <div className="space-y-2">
                {sigsQ.data.map((s) => {
                  const ok = !s.err;
                  const ts = typeof s.blockTime === "number" ? s.blockTime * 1000 : null;
                  return (
                    <a
                      key={s.signature}
                      href={`https://solscan.io/tx/${encodeURIComponent(s.signature)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-secondary/30 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-sm text-foreground">{shortAddr(s.signature)}</div>
                        <div className="text-xs text-muted-foreground">{ts ? timeAgo(ts) : "—"}</div>
                      </div>
                      <div className={cn("shrink-0 text-xs font-mono", ok ? "text-accent" : "text-destructive")}>
                        {ok ? "OK" : "ERR"}
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No recent transactions.</div>
            )}
          </div>
        </>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
        <DrawerContent className="max-h-[85vh]">
          <div className="p-4">{Content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
      <SheetContent side="right" className="w-[420px] sm:max-w-none p-5 bg-background/95 backdrop-blur border-border/50">
        {Content}
      </SheetContent>
    </Sheet>
  );
}

