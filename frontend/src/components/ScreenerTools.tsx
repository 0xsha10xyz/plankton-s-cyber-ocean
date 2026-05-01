import { useState } from "react";
import { motion } from "framer-motion";
import { Wallet, BarChart3, ArrowUpRight, ArrowDownRight, Filter, Download } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@/contexts/WalletModalContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { getApiBase } from "@/lib/api";
import { buildCsv, downloadBlob } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PairRow = { symbol: string; price: number; change24h: number; volume: string; marketCap: string };

export default function ScreenerTools() {
  const { connected } = useWallet();
  const { openWalletModal } = useWalletModal();
  const { tierName, limits } = useSubscription();

  const maxResults = limits.screenerMaxResults;
  const canFilterVolume = limits.screenerFiltersEnabled.includes("volume");
  const canFilterMarketCap = limits.screenerFiltersEnabled.includes("marketCap");
  const canFilterChange24h = limits.screenerFiltersEnabled.includes("change24h");
  const canSort = limits.screenerFiltersEnabled.includes("sort");

  const [minVolume, setMinVolume] = useState("");
  const [minMarketCap, setMinMarketCap] = useState("");
  const [minChange24h, setMinChange24h] = useState("");
  const [maxChange24h, setMaxChange24h] = useState("");
  const [sort, setSort] = useState("volume");
  const [loading, setLoading] = useState(false);
  const [pairs, setPairs] = useState<PairRow[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const exportCsv = () => {
    if (pairs.length === 0 || !limits.exportAllowed) return;
    const headers = ["Symbol", "Price", "24h %", "Volume", "Market cap"];
    const rows = pairs.map((p) => [
      p.symbol,
      p.price.toFixed(4),
      `${p.change24h >= 0 ? "+" : ""}${p.change24h}%`,
      p.volume,
      p.marketCap,
    ]);
    const csv = buildCsv(headers, rows);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const timestamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
    downloadBlob(blob, `plankton-screener-${timestamp}.csv`);
  };

  const runScreener = async () => {
    if (!connected) return;
    setLoading(true);
    setPairs([]);
    setTotal(0);
    setError(null);
    try {
      const base = getApiBase();
      if (!base) {
        setError("API unreachable. On Vercel, use same-origin /api; only set VITE_API_URL with VITE_API_MODE=external for a split backend.");
        setLoading(false);
        return;
      }
      const params = new URLSearchParams();
      params.set("limit", String(maxResults));
      if (canSort) params.set("sort", sort);
      if (canFilterVolume && minVolume) params.set("minVolume", String(parseInt(minVolume, 10) || 0));
      if (canFilterMarketCap && minMarketCap) params.set("minMarketCap", String(parseInt(minMarketCap, 10) || 0));
      if (canFilterChange24h && minChange24h !== "") params.set("minChange24h", minChange24h);
      if (canFilterChange24h && maxChange24h !== "") params.set("maxChange24h", maxChange24h);
      const res = await fetch(`${base}/api/research/screener?${params}`);
      if (!res.ok) {
        setError("Unable to load results. Try again.");
        return;
      }
      let data: { pairs?: PairRow[]; total?: number };
      try {
        data = await res.json();
      } catch {
        setError("Invalid response from server.");
        return;
      }
      setPairs(data.pairs ?? []);
      setTotal(data.total ?? data.pairs?.length ?? 0);
    } catch {
      setError("Network error. Check connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!connected) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <Wallet className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Connect your wallet</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
          Run the token screener with filters and see results up to your tier limit after connecting your wallet.
        </p>
        <Button onClick={openWalletModal} className="gap-2">
          <Wallet size={18} />
          Connect Wallet
        </Button>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <BarChart3 size={18} className="text-primary" />
        <h3 className="text-base font-semibold text-foreground">Token screener</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          Up to {maxResults} results ({tierName})
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-muted-foreground shrink-0" />
          {canFilterVolume && (
            <div>
              <label className="text-xs text-muted-foreground block mb-0.5">Min volume</label>
              <Input
                type="number"
                placeholder="0"
                value={minVolume}
                onChange={(e) => setMinVolume(e.target.value)}
                className="w-24 h-8 text-sm bg-secondary/50 border-border"
              />
            </div>
          )}
          {canFilterMarketCap && (
            <div>
              <label className="text-xs text-muted-foreground block mb-0.5">Min mcap</label>
              <Input
                type="number"
                placeholder="0"
                value={minMarketCap}
                onChange={(e) => setMinMarketCap(e.target.value)}
                className="w-24 h-8 text-sm bg-secondary/50 border-border"
              />
            </div>
          )}
          {canFilterChange24h && (
            <>
              <div>
                <label className="text-xs text-muted-foreground block mb-0.5">24h % min</label>
                <Input
                  type="number"
                  placeholder="N/A"
                  value={minChange24h}
                  onChange={(e) => setMinChange24h(e.target.value)}
                  className="w-20 h-8 text-sm bg-secondary/50 border-border"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-0.5">24h % max</label>
                <Input
                  type="number"
                  placeholder="N/A"
                  value={maxChange24h}
                  onChange={(e) => setMaxChange24h(e.target.value)}
                  className="w-20 h-8 text-sm bg-secondary/50 border-border"
                />
              </div>
            </>
          )}
          {canSort && (
            <div>
              <label className="text-xs text-muted-foreground block mb-0.5">Sort by</label>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-28 h-8 text-sm bg-secondary/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="volume">Volume</SelectItem>
                  <SelectItem value="change24h">24h %</SelectItem>
                  <SelectItem value="marketCap">Market cap</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <Button onClick={runScreener} disabled={loading} className="gap-2">
          {loading ? "Running…" : "Run screener"}
        </Button>
      </div>

      {pairs.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="overflow-x-auto rounded-lg border border-border/50"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30">
                <th className="text-left py-2 px-3 font-semibold text-foreground">Symbol</th>
                <th className="text-right py-2 px-3 font-semibold text-foreground">Price</th>
                <th className="text-right py-2 px-3 font-semibold text-foreground">24h %</th>
                <th className="text-right py-2 px-3 font-semibold text-foreground">Volume</th>
                <th className="text-right py-2 px-3 font-semibold text-foreground">Market cap</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((row) => (
                <tr key={row.symbol} className="border-b border-border/30 hover:bg-secondary/20">
                  <td className="py-2 px-3 font-mono text-foreground">{row.symbol}</td>
                  <td className="py-2 px-3 text-right font-mono text-primary">${row.price.toFixed(4)}</td>
                  <td className="py-2 px-3 text-right">
                    <span
                      className={`inline-flex items-center gap-0.5 font-mono font-medium ${
                        row.change24h >= 0 ? "text-accent" : "text-destructive"
                      }`}
                    >
                      {row.change24h >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      {row.change24h >= 0 ? "+" : ""}{row.change24h}%
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right text-muted-foreground">{row.volume}</td>
                  <td className="py-2 px-3 text-right text-muted-foreground">{row.marketCap}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-border/30">
            <span className="text-xs text-muted-foreground">
              Showing {pairs.length} of {total} matches. {maxResults < 200 && tierName === "Free" && "Upgrade for more results, filters, and CSV export."}
            </span>
            {limits.exportAllowed && (
              <Button variant="ghost" size="sm" onClick={exportCsv} className="gap-1.5 text-xs h-8">
                <Download size={14} />
                Export CSV
              </Button>
            )}
          </div>
        </motion.div>
      )}

      {!loading && pairs.length === 0 && total === 0 && (
        <p className={`text-sm text-center py-6 ${error ? "text-destructive" : "text-muted-foreground"}`}>
          {error ?? "Set filters and click \u201cRun screener\u201d to see pairs."}
        </p>
      )}
    </div>
  );
}
