import { useState, useCallback, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction, PublicKey } from "@solana/web3.js";
import { ArrowDownLeft, Loader2, Wallet, PlusCircle } from "lucide-react";
import ParticleBackground from "@/components/ParticleBackground";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { TradingChart } from "@/components/TradingChart";
import { TotalUsersStat } from "@/components/TotalUsersStat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWalletModal } from "@/contexts/WalletModalContext";
import {
  COMMON_MINTS,
  getQuote,
  getSwapTransaction,
  toRawAmount,
  type JupiterQuoteResponse,
} from "@/lib/jupiter";
import { sendRawTransactionWithFallback } from "@/lib/solana-rpc";
import { useWalletBalances } from "@/contexts/WalletBalancesContext";
import { getApiBase } from "@/lib/api";

export type TokenOption = { symbol: string; mint: string; decimals: number };

const TOKEN_OPTIONS: TokenOption[] = [
  { symbol: "SOL", mint: COMMON_MINTS.SOL, decimals: 9 },
  { symbol: "USDC", mint: COMMON_MINTS.USDC, decimals: 6 },
  { symbol: "USDT", mint: COMMON_MINTS.USDT, decimals: 6 },
];

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export default function Swap() {
  const { connection } = useConnection();
  const { publicKey, connected, signTransaction } = useWallet();
  const { openWalletModal } = useWalletModal();

  const [inputToken, setInputToken] = useState(TOKEN_OPTIONS[0]);
  const [outputToken, setOutputToken] = useState(TOKEN_OPTIONS[1]);
  const [amount, setAmount] = useState("");
  const [slippageBps] = useState(50);
  const [quote, setQuote] = useState<JupiterQuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [swapLoading, setSwapLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [customTokens, setCustomTokens] = useState<TokenOption[]>([]);
  const [customCaInput, setCustomCaInput] = useState("");
  const [addTokenLoading, setAddTokenLoading] = useState(false);
  const [addTokenError, setAddTokenError] = useState<string | null>(null);

  const tokenOptions = useMemo(
    () => [...TOKEN_OPTIONS, ...customTokens],
    [customTokens]
  );

  const {
    solLamports,
    tokenBalancesByMint,
    refetch: refetchBalances,
  } = useWalletBalances();

  const solBalance = solLamports != null ? solLamports / 1e9 : 0;
  const tokenBalances = tokenBalancesByMint;

  const getBalanceForToken = (token: TokenOption) => {
    if (token.symbol === "SOL" && token.mint === COMMON_MINTS.SOL) return solBalance;
    return tokenBalances[token.mint] ?? 0;
  };

  /** Max spendable: for SOL leave ~0.005 for tx fees; for SPL use full balance */
  const getMaxAmount = (token: TokenOption) => {
    const balance = getBalanceForToken(token);
    if (token.symbol === "SOL") return Math.max(0, balance - 0.005);
    return balance;
  };

  const hasInsufficientBalance = amount.trim() !== "" && Number.isFinite(parseFloat(amount)) && parseFloat(amount) > getBalanceForToken(inputToken);

  const pairLabel = `${inputToken.symbol}/${outputToken.symbol}`;

  const fetchQuote = useCallback(async () => {
    const rawAmount = toRawAmount(amount, inputToken.decimals);
    if (rawAmount === "0") {
      setQuote(null);
      setError("Enter an amount");
      return;
    }
    const balance = getBalanceForToken(inputToken);
    const amountNum = parseFloat(amount);
    if (Number.isFinite(amountNum) && amountNum > balance) {
      setQuote(null);
      setError("Insufficient balance");
      return;
    }
    setError(null);
    setQuote(null);
    setQuoteLoading(true);
    try {
      const q = await getQuote({
        inputMint: inputToken.mint,
        outputMint: outputToken.mint,
        amount: rawAmount,
        slippageBps,
      });
      setQuote(q ?? null);
      if (!q) setError("Could not get quote. Check connection and try again.");
    } catch (e) {
      setError("Failed to get quote. Try again.");
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [inputToken, outputToken, amount, slippageBps]);

  const executeSwap = useCallback(async () => {
    if (!quote || !publicKey || !signTransaction) return;
    setError(null);
    setTxSuccess(null);
    setSwapLoading(true);
    try {
      const swapRes = await getSwapTransaction({
        quoteResponse: quote,
        userPublicKey: publicKey.toBase58(),
        wrapAndUnwrapSol: true,
      });
      if (!swapRes?.swapTransaction) {
        setError("Failed to build swap. Quote may have expired — try Get quote again.");
        return;
      }
      const txBuf = base64ToUint8Array(swapRes.swapTransaction);
      const tx = VersionedTransaction.deserialize(txBuf);
      const signed = await signTransaction(tx);
      const sig = await sendRawTransactionWithFallback(connection, signed.serialize(), {
        skipPreflight: false,
        maxRetries: 5,
        preflightCommitment: "confirmed",
      });
      setTxSuccess(sig);
      setQuote(null);
      setAmount("");
      refetchBalances();
      setTimeout(() => refetchBalances(), 2500);
      try {
        await Promise.race([
          connection.confirmTransaction(sig, "confirmed"),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 60_000)),
        ]);
        // Once confirmed, refresh again so UI matches chain state without manual reload.
        refetchBalances();
      } catch {
        // Tx was sent; confirmation timeout is non-fatal
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Swap failed. Try again.";
      setError(msg);
    } finally {
      setSwapLoading(false);
    }
  }, [quote, publicKey, signTransaction, connection, refetchBalances]);

  const switchTokens = () => {
    setInputToken(outputToken);
    setOutputToken(inputToken);
    setQuote(null);
    setError(null);
  };

  const handleAddCustomToken = useCallback(async () => {
    const raw = customCaInput.trim();
    if (!raw || raw.length < 32 || raw.length > 44) {
      setAddTokenError("Enter a valid Solana token mint (CA), 32–44 characters");
      return;
    }
    if (tokenOptions.some((t) => t.mint === raw)) {
      setAddTokenError("Token already in list");
      return;
    }
    setAddTokenError(null);
    setAddTokenLoading(true);
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/market/token-info?mint=${encodeURIComponent(raw)}`);
      const data = await res.json();
      if (!res.ok) {
        setAddTokenError(data?.error || "Token not found");
        return;
      }
      const symbol = typeof data.symbol === "string" ? data.symbol : `${raw.slice(0, 4)}…${raw.slice(-4)}`;
      const decimals = Number(data.decimals);
      if (!Number.isFinite(decimals) || decimals < 0 || decimals > 18) {
        setAddTokenError("Invalid decimals");
        return;
      }
      setCustomTokens((prev) => [...prev, { symbol, mint: raw, decimals }]);
      setCustomCaInput("");
    } catch (e) {
      setAddTokenError("Failed to fetch token info");
    } finally {
      setAddTokenLoading(false);
    }
  }, [customCaInput, tokenOptions]);

  if (!connected) {
    return (
      <div className="relative min-h-screen">
        <ParticleBackground />
        <Header />
        <main className="relative z-10 pt-24 container mx-auto px-4 py-16">
          <div className="glass-card rounded-xl p-8 max-w-md mx-auto text-center">
            <Wallet className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h1 className="text-xl font-bold text-foreground mb-2">Connect wallet to swap</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Manual swap is available after you connect your Solana wallet. Use the chart and swap form to trade until the autonomous agent is ready.
            </p>
            <Button onClick={openWalletModal} className="gap-2">
              <Wallet size={18} />
              Connect Wallet
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <ParticleBackground />
      <Header />
      <main className="relative z-10 pt-24 container mx-auto px-4 py-8">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="section-title mb-6"
        >
          Swap
        </motion.h1>
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <TotalUsersStat variant="strip" />
        </div>
        <p className="text-muted-foreground text-sm mb-8 max-w-2xl">
          Trade manually with the chart and swap form. When the autonomous protocol is live, you’ll be able to let the agent execute for you.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart */}
          <div className="lg:col-span-2 glass-card rounded-xl p-6">
            <TradingChart pairLabel={pairLabel} inputMint={inputToken.mint} />
          </div>

          {/* Swap form */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <ArrowDownLeft size={18} className="text-primary" />
              <h2 className="text-base font-semibold text-foreground">Manual swap</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">From</label>
                <div className="flex gap-2">
                  <select
                    value={inputToken.mint}
                    onChange={(e) => {
                      const t = tokenOptions.find((x) => x.mint === e.target.value);
                      if (t) setInputToken(t);
                    }}
                    className="h-10 min-w-[7rem] max-w-[12rem] rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {tokenOptions.map((t) => (
                      <option key={t.mint} value={t.mint}>{t.symbol}</option>
                    ))}
                  </select>
                  <div className="flex-1 space-y-1">
                    <Input
                      type="number"
                      placeholder="0.0"
                      min="0"
                      step="any"
                      value={amount}
                      onChange={(e) => { setAmount(e.target.value); setQuote(null); }}
                      className="w-full bg-secondary/50 border-border"
                    />
                    <p className="text-xs text-muted-foreground">
                      Balance: {getBalanceForToken(inputToken).toLocaleString(undefined, { maximumFractionDigits: 6 })} {inputToken.symbol}
                      <button
                        type="button"
                        onClick={() => setAmount(String(getMaxAmount(inputToken)))}
                        className="ml-2 text-primary hover:underline"
                      >
                        Max
                      </button>
                    </p>
                    {hasInsufficientBalance && (
                      <p className="text-xs text-destructive">Amount exceeds balance</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={switchTokens}
                  className="p-2 rounded-lg border border-border/50 hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                  aria-label="Switch tokens"
                >
                  <ArrowDownLeft size={20} className="rotate-180" />
                </motion.button>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">To</label>
                <div className="flex gap-2">
                  <select
                    value={outputToken.mint}
                    onChange={(e) => {
                      const t = tokenOptions.find((x) => x.mint === e.target.value);
                      if (t) setOutputToken(t);
                    }}
                    className="h-10 min-w-[7rem] max-w-[12rem] rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {tokenOptions.map((t) => (
                      <option key={t.mint} value={t.mint}>{t.symbol}</option>
                    ))}
                  </select>
                  <div className="flex-1 space-y-1">
                    <Input
                      readOnly
                      placeholder="0.0"
                      value={
                        quote && quote.outAmount != null
                          ? (() => {
                              const n = Number(quote.outAmount) / 10 ** outputToken.decimals;
                              const s = Number.isFinite(n) ? n.toFixed(6).replace(/\.?0+$/, "") : "";
                              return s || "0";
                            })()
                          : ""
                      }
                      className="w-full bg-secondary/30 border-border text-muted-foreground"
                    />
                    <p className="text-xs text-muted-foreground">
                      Balance: {getBalanceForToken(outputToken).toLocaleString(undefined, { maximumFractionDigits: 6 })} {outputToken.symbol}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 space-y-2">
                <p className="text-xs font-medium text-foreground">Add token by contract address (CA)</p>
                <p className="text-xs text-muted-foreground">Paste a Solana token mint address to swap it. Chart will show real-time data when BIRDEYE_API_KEY is set.</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
                    value={customCaInput}
                    onChange={(e) => { setCustomCaInput(e.target.value); setAddTokenError(null); }}
                    className="flex-1 font-mono text-xs bg-background"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddCustomToken}
                    disabled={addTokenLoading || !customCaInput.trim()}
                    className="gap-1.5 shrink-0"
                  >
                    {addTokenLoading ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
                    Add
                  </Button>
                </div>
                {addTokenError && <p className="text-xs text-destructive">{addTokenError}</p>}
              </div>

              {quote && (
                <p className="text-xs text-muted-foreground">
                  Price impact: {quote.priceImpactPct ? `${Number(quote.priceImpactPct).toFixed(2)}%` : "—"}
                </p>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
              {txSuccess && (
                <p className="text-sm text-accent">
                  Success!{" "}
                  <a
                    href={`https://solscan.io/tx/${txSuccess}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    View on Solscan
                  </a>
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="secondary"
                  onClick={fetchQuote}
                  disabled={quoteLoading || !amount.trim() || hasInsufficientBalance}
                  className="flex-1 gap-2"
                >
                  {quoteLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                  Get quote
                </Button>
                <Button
                  onClick={executeSwap}
                  disabled={swapLoading || !quote}
                  className="flex-1 gap-2"
                >
                  {swapLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                  Swap
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
