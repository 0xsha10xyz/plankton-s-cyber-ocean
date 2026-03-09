import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { ArrowDownLeft, Loader2, Wallet } from "lucide-react";
import ParticleBackground from "@/components/ParticleBackground";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { TradingChart } from "@/components/TradingChart";
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

const TOKEN_OPTIONS = [
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

  const pairLabel = `${inputToken.symbol}/${outputToken.symbol}`;

  const fetchQuote = useCallback(async () => {
    const rawAmount = toRawAmount(amount, inputToken.decimals);
    if (rawAmount === "0") {
      setQuote(null);
      setError("Enter an amount");
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
      setQuote(q);
      if (!q) setError("No route found. Try a different pair or amount.");
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
        setError("Failed to build swap. Quote may have expired.");
        return;
      }
      const txBuf = base64ToUint8Array(swapRes.swapTransaction);
      const tx = VersionedTransaction.deserialize(txBuf);
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      setTxSuccess(sig);
      setQuote(null);
      setAmount("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Swap failed. Try again.";
      setError(msg);
    } finally {
      setSwapLoading(false);
    }
  }, [quote, publicKey, signTransaction, connection]);

  const switchTokens = () => {
    setInputToken(outputToken);
    setOutputToken(inputToken);
    setQuote(null);
    setError(null);
  };

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
        <p className="text-muted-foreground text-sm mb-8 max-w-2xl">
          Trade manually with the chart and swap form. When the autonomous protocol is live, you’ll be able to let the agent execute for you.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart */}
          <div className="lg:col-span-2 glass-card rounded-xl p-6">
            <TradingChart pairLabel={pairLabel} />
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
                    value={inputToken.symbol}
                    onChange={(e) => setInputToken(TOKEN_OPTIONS.find((t) => t.symbol === e.target.value) ?? inputToken)}
                    className="h-10 w-24 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {TOKEN_OPTIONS.map((t) => (
                      <option key={t.mint} value={t.symbol}>{t.symbol}</option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    placeholder="0.0"
                    min="0"
                    step="any"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); setQuote(null); }}
                    className="flex-1 bg-secondary/50 border-border"
                  />
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
                    value={outputToken.symbol}
                    onChange={(e) => setOutputToken(TOKEN_OPTIONS.find((t) => t.symbol === e.target.value) ?? outputToken)}
                    className="h-10 w-24 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {TOKEN_OPTIONS.map((t) => (
                      <option key={t.mint} value={t.symbol}>{t.symbol}</option>
                    ))}
                  </select>
                  <Input
                    readOnly
                    placeholder="0.0"
                    value={quote ? (Number(quote.outAmount) / 10 ** outputToken.decimals).toFixed(6) : ""}
                    className="flex-1 bg-secondary/30 border-border text-muted-foreground"
                  />
                </div>
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
                  disabled={quoteLoading || !amount.trim()}
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
