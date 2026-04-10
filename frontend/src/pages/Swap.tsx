import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
import { useSearchParams } from "react-router-dom";
import {
  COMMON_MINTS,
  getQuote,
  getSwapTransaction,
  toRawAmount,
  type JupiterQuoteResponse,
} from "@/lib/jupiter";
import { sendRawTransactionWithFallback } from "@/lib/solana-rpc";
import { useWalletBalances } from "@/contexts/WalletBalancesContext";
import { useTokenSymbol } from "@/contexts/TokenSymbolContext";
import { getApiBase } from "@/lib/api";
import { TokenSelect, type TokenOption } from "@/components/TokenSelect";

export type { TokenOption };

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

/** Use before using `quoteOverride` — `onClick={fn}` passes a React mouse event as the first arg. */
function isJupiterQuoteResponse(x: unknown): x is JupiterQuoteResponse {
  if (x === null || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.inAmount === "string" &&
    typeof o.outAmount === "string" &&
    typeof o.inputMint === "string" &&
    typeof o.outputMint === "string"
  );
}

async function getDecimalsViaRpcProxy(base: string, mint: string): Promise<number | null> {
  try {
    const res = await fetch(`${base}/api/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenSupply",
        params: [mint],
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const raw = json?.result?.value?.decimals;
    const decimals = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(decimals) || decimals < 0 || decimals > 18) return null;
    return decimals;
  } catch {
    return null;
  }
}

function chooseTokenLabel(mint: string, symbolRaw: unknown, nameRaw: unknown): string {
  const fallback = `${mint.slice(0, 4)}…${mint.slice(-4)}`;
  const symbol = typeof symbolRaw === "string" ? symbolRaw.trim() : "";
  const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
  if (name && !name.includes("…")) return name;
  if (symbol && !symbol.includes("…")) return symbol;
  return name || symbol || fallback;
}

export default function Swap() {
  const { connection } = useConnection();
  const { publicKey, connected, signTransaction } = useWallet();
  const { openWalletModal } = useWalletModal();
  const [searchParams] = useSearchParams();
  const walletAddress = publicKey?.toBase58() ?? "";
  const didAgentAutoExecuteRef = useRef(false);

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
  const [resolveLoading, setResolveLoading] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [walletTokenOptions, setWalletTokenOptions] = useState<TokenOption[]>([]);
  const { ensureTokenInfo, getSymbol, setTokenInfo } = useTokenSymbol();

  const {
    solLamports,
    tokens: walletTokens,
    tokenBalancesByMint,
    refetch: refetchBalances,
  } = useWalletBalances();

  const savedTokensStorageKey = useMemo(() => {
    return walletAddress ? `plankton_saved_tokens_${walletAddress}` : "";
  }, [walletAddress]);

  const loadSavedTokens = useCallback((): TokenOption[] => {
    if (!savedTokensStorageKey) return [];
    try {
      const raw = localStorage.getItem(savedTokensStorageKey);
      if (!raw) return [];
      const arr = JSON.parse(raw) as unknown;
      if (!Array.isArray(arr)) return [];
      return arr
        .map((t) => {
          const mint = typeof (t as { mint?: unknown }).mint === "string" ? (t as { mint: string }).mint : "";
          const symbol = typeof (t as { symbol?: unknown }).symbol === "string" ? (t as { symbol: string }).symbol : "";
          const decimals = Number((t as { decimals?: unknown }).decimals);
          if (!mint || !symbol || !Number.isFinite(decimals)) return null;
          return { mint, symbol, decimals } satisfies TokenOption;
        })
        .filter((x): x is TokenOption => Boolean(x));
    } catch {
      return [];
    }
  }, [savedTokensStorageKey]);

  const persistSavedTokens = useCallback((tokens: TokenOption[]) => {
    if (!savedTokensStorageKey) return;
    try {
      localStorage.setItem(savedTokensStorageKey, JSON.stringify(tokens));
    } catch {
      // ignore
    }
  }, [savedTokensStorageKey]);

  // Load saved tokens for this wallet, but only keep ones with a positive balance.
  useEffect(() => {
    if (!walletAddress) {
      setCustomTokens([]);
      return;
    }
    const knownMints = new Set(TOKEN_OPTIONS.map((o) => o.mint));
    const saved = loadSavedTokens().filter((t) => !knownMints.has(t.mint));
    const withBalance = saved.filter((t) => (tokenBalancesByMint[t.mint] ?? 0) > 0);
    setCustomTokens(withBalance);
    // keep storage in sync (drop tokens with 0 balance)
    persistSavedTokens(withBalance);
  }, [walletAddress, loadSavedTokens, persistSavedTokens, tokenBalancesByMint]);

  useEffect(() => {
    if (!walletTokens.length) {
      setWalletTokenOptions([]);
      return;
    }
    const knownMints = new Set(TOKEN_OPTIONS.map((o) => o.mint));
    const list = walletTokens
      .filter((t) => !knownMints.has(t.mint))
      .filter((t) => (tokenBalancesByMint[t.mint] ?? 0) > 0);
    if (list.length === 0) {
      setWalletTokenOptions([]);
      return;
    }
    let cancelled = false;
    Promise.all(list.map((t) => ensureTokenInfo(t.mint))).then((infos) => {
      if (cancelled) return;
      const options: TokenOption[] = list.map((t, i) => ({
        symbol: infos[i]?.symbol ?? getSymbol(t.mint),
        mint: t.mint,
        decimals: t.decimals,
      }));
      setWalletTokenOptions(options);
    });
    return () => { cancelled = true; };
  }, [walletTokens, tokenBalancesByMint, ensureTokenInfo, getSymbol]);

  const tokenOptions = useMemo(() => {
    const byMint = new Map<string, TokenOption>();
    for (const t of TOKEN_OPTIONS) byMint.set(t.mint, t);
    for (const t of customTokens) if (!byMint.has(t.mint)) byMint.set(t.mint, t);
    for (const t of walletTokenOptions) if (!byMint.has(t.mint)) byMint.set(t.mint, t);
    return Array.from(byMint.values());
  }, [customTokens, walletTokenOptions]);

  const solBalance = solLamports != null ? solLamports / 1e9 : 0;
  const tokenBalances = tokenBalancesByMint;

  const getBalanceForToken = useCallback((token: TokenOption) => {
    if (token.symbol === "SOL" && token.mint === COMMON_MINTS.SOL) return solBalance;
    return tokenBalances[token.mint] ?? 0;
  }, [solBalance, tokenBalances]);

  /** Max spendable: for SOL leave ~0.005 for tx fees; for SPL use full balance */
  const getMaxAmount = (token: TokenOption) => {
    const balance = getBalanceForToken(token);
    if (token.symbol === "SOL") return Math.max(0, balance - 0.005);
    return balance;
  };

  const hasInsufficientBalance = amount.trim() !== "" && Number.isFinite(parseFloat(amount)) && parseFloat(amount) > getBalanceForToken(inputToken);

  const pairLabel = `${inputToken.symbol}/${outputToken.symbol}`;

  const isStable = (m: string) => m === COMMON_MINTS.USDC || m === COMMON_MINTS.USDT;
  const pairHasStable = isStable(inputToken.mint) || isStable(outputToken.mint);
  const solMint = COMMON_MINTS.SOL;
  const pairIsTokenSol =
    !pairHasStable &&
    (inputToken.mint === solMint || outputToken.mint === solMint);

  // For stable pairs (SOL/USDC, token/USDT), use pair chart directly so it is live immediately from pair endpoints.
  const stableMintInPair = pairHasStable
    ? (isStable(inputToken.mint) ? inputToken.mint : outputToken.mint)
    : undefined;
  const nonStableMintInPair = stableMintInPair
    ? (inputToken.mint === stableMintInPair ? outputToken.mint : inputToken.mint)
    : undefined;

  // When pair is token/SOL, chart shows token/SOL price (base=token, quote=SOL).
  // When pair has stable coin, chart shows token/stable pair (base=non-stable, quote=stable).
  // Otherwise chart shows single-token USD.
  const chartMint =
    inputToken.mint === COMMON_MINTS.USDC || inputToken.mint === COMMON_MINTS.USDT
      ? outputToken.mint
      : inputToken.mint;
  const chartQuoteMint: string | undefined = stableMintInPair ?? (pairIsTokenSol ? solMint : undefined);
  const chartBaseMint = stableMintInPair
    ? (nonStableMintInPair ?? chartMint)
    : pairIsTokenSol
      ? (inputToken.mint === solMint ? outputToken.mint : inputToken.mint)
      : chartMint;

  let latestPriceFromQuote: number | null = null;
  // Only use quote as "price" when the pair is vs USDC/USDT so the value is USD per token. SOL/SYRA etc. use pair API.
  if (quote && quote.outAmount != null && pairHasStable) {
    const inAmt = parseFloat(amount) || 0;
    const outAmt = Number(quote.outAmount) / 10 ** outputToken.decimals;
    if (outAmt > 0 && inAmt > 0) {
      const stableAmt = isStable(inputToken.mint) ? inAmt : outAmt;
      const chartMintAmt = chartMint === inputToken.mint ? inAmt : outAmt;
      latestPriceFromQuote = stableAmt / chartMintAmt;
    }
  }

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
      setError(e instanceof Error ? e.message : "Failed to get quote. Try again.");
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [inputToken, outputToken, amount, slippageBps, getBalanceForToken]);

  const executeSwap = useCallback(async (quoteOverride?: JupiterQuoteResponse | null) => {
    // Callers may pass a quote, or the Swap button passes a React click event — never treat events as quotes.
    const override = isJupiterQuoteResponse(quoteOverride) ? quoteOverride : null;
    let finalQuote = override;

    if (!publicKey || !signTransaction) {
      setError(
        "Wallet is not ready to sign transactions. Open the wallet menu, reconnect, then try again."
      );
      return;
    }
    setError(null);
    setTxSuccess(null);
    setSwapLoading(true);
    try {
      if (!finalQuote) {
        const rawAmount = toRawAmount(amount, inputToken.decimals);
        if (rawAmount === "0") {
          setError("Enter an amount");
          return;
        }

        const balance = getBalanceForToken(inputToken);
        const amountNum = parseFloat(amount);
        if (Number.isFinite(amountNum) && amountNum > balance) {
          setError("Insufficient balance");
          return;
        }

        finalQuote = await getQuote({
          inputMint: inputToken.mint,
          outputMint: outputToken.mint,
          amount: rawAmount,
          slippageBps,
        });
      }

      if (!finalQuote) {
        setError("Could not get quote. Try Get quote again.");
        return;
      }

      const buildAndSend = async (q: JupiterQuoteResponse) => {
        const swapRes = await getSwapTransaction({
          quoteResponse: q,
          userPublicKey: publicKey.toBase58(),
          wrapAndUnwrapSol: true,
        });
        if (!swapRes?.swapTransaction) {
          throw new Error("Swap transaction build failed (missing swapTransaction from Jupiter).");
        }
        const txBuf = base64ToUint8Array(swapRes.swapTransaction);
        const tx = VersionedTransaction.deserialize(txBuf);
        const signed = await signTransaction(tx);
        const sig = await sendRawTransactionWithFallback(connection, signed.serialize(), {
          skipPreflight: false,
          maxRetries: 5,
          preflightCommitment: "confirmed",
        });
        return sig;
      };

      let sig: string;
      try {
        sig = await buildAndSend(finalQuote);
      } catch (e) {
        // If a quote expires between fetch and build, retry once with a fresh quote.
        if (override) throw e;

        const rawAmount = toRawAmount(amount, inputToken.decimals);
        const freshQuote = await getQuote({
          inputMint: inputToken.mint,
          outputMint: outputToken.mint,
          amount: rawAmount,
          slippageBps,
        });
        if (!freshQuote) throw e;
        sig = await buildAndSend(freshQuote);
      }
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
      if (import.meta.env.DEV) {
        console.debug("[swap] failed", {
          message: e instanceof Error ? e.message : String(e),
          wallet: publicKey?.toBase58(),
        });
      }
      setError(e instanceof Error ? e.message : "Swap failed. Try again.");
    } finally {
      setSwapLoading(false);
    }
  }, [
    publicKey,
    signTransaction,
    connection,
    refetchBalances,
    amount,
    inputToken,
    outputToken,
    slippageBps,
    getBalanceForToken,
  ]);

  const switchTokens = () => {
    setInputToken(outputToken);
    setOutputToken(inputToken);
    setQuote(null);
    setError(null);
  };

  const resolveAndAddToken = useCallback(async (ca: string): Promise<TokenOption | null> => {
    const raw = ca.trim();
    const invalid = mintValidationMessage(raw);
    if (invalid) {
      setResolveError(invalid);
      return null;
    }
    const existing = tokenOptions.find((t) => t.mint === raw);
    if (existing) return existing;
    setResolveError(null);
    setResolveLoading(true);
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/market/token-info?mint=${encodeURIComponent(raw)}`);
      const text = await res.text();
      let data: { error?: string; symbol?: unknown; name?: unknown; decimals?: unknown } = {};
      try {
        if (text.trim().startsWith("{")) data = JSON.parse(text) as typeof data;
      } catch {
        data = {};
      }
      if (!res.ok) {
        if (res.status === 404 && !data.error && !text.trim().startsWith("{")) {
          setResolveError(
            "API returned 404 (HTML). Deploy must include repo-root `api/` — set Vercel Root Directory to “.” and redeploy."
          );
          return null;
        }
        // Fallback path for production incidents: get decimals directly via RPC proxy.
        const decimalsFromRpc = await getDecimalsViaRpcProxy(base, raw);
        if (decimalsFromRpc == null) {
          setResolveError(data.error || "Token not found or could not load metadata");
          return null;
        }
        const fallbackSymbol = getSymbol(raw);
        const fallbackToken: TokenOption = { symbol: fallbackSymbol, mint: raw, decimals: decimalsFromRpc };
        setTokenInfo(raw, fallbackSymbol, decimalsFromRpc);
        return fallbackToken;
      }
      const symbolFromApi = chooseTokenLabel(
        raw,
        (data as { symbol?: unknown }).symbol,
        (data as { name?: unknown }).name
      );
      const symbol = symbolFromApi || getSymbol(raw);
      const decimals = Number(data.decimals);
      if (!Number.isFinite(decimals) || decimals < 0 || decimals > 18) {
        setResolveError("Invalid token");
        return null;
      }
      const token: TokenOption = { symbol, mint: raw, decimals };
      await ensureTokenInfo(raw);
      const balance = tokenBalancesByMint[raw] ?? 0;
      if (balance > 0) {
        const symbolToSave = symbolFromApi && !symbolFromApi.includes("…") ? symbolFromApi : symbol;
        setTokenInfo(raw, symbolToSave, decimals);
        if (savedTokensStorageKey) {
          setCustomTokens((prev) => (prev.some((t) => t.mint === raw) ? prev : [...prev, { ...token, symbol: symbolToSave }]));
          const next = [...loadSavedTokens().filter((t) => t.mint !== raw), { ...token, symbol: symbolToSave }];
          persistSavedTokens(next);
        }
      }
      return token;
    } catch {
      setResolveError("Could not load token");
      return null;
    } finally {
      setResolveLoading(false);
    }
  }, [tokenOptions, ensureTokenInfo, getSymbol, setTokenInfo, tokenBalancesByMint, savedTokensStorageKey, loadSavedTokens, persistSavedTokens]);

  // Agent autopilot execution: when the chat navigates here with query params,
  // build a quote and immediately execute so the wallet confirmation popup appears.
  useEffect(() => {
    const autoExecute = searchParams.get("autoExecute") === "1";
    const inMint = searchParams.get("inMint") ?? "";
    const outMint = searchParams.get("outMint") ?? "";
    const amountParam = searchParams.get("amount") ?? "";

    if (!autoExecute) return;
    if (didAgentAutoExecuteRef.current) return;
    if (!connected || !publicKey || !signTransaction) return;
    if (!inMint || !outMint || !amountParam) return;

    didAgentAutoExecuteRef.current = true;

    (async () => {
      const inTok = await resolveAndAddToken(inMint);
      const outTok = await resolveAndAddToken(outMint);
      if (!inTok || !outTok) return;

      // Update UI state for clarity.
      setInputToken(inTok);
      setOutputToken(outTok);
      setAmount(amountParam);
      setError(null);
      setQuote(null);

      const rawAmount = toRawAmount(amountParam, inTok.decimals);
      if (rawAmount === "0") return;

      const q = await getQuote({
        inputMint: inTok.mint,
        outputMint: outTok.mint,
        amount: rawAmount,
        slippageBps,
      });

      if (!q) return;
      setQuote(q);
      await executeSwap(q);
    })();
  }, [searchParams, connected, publicKey, signTransaction, resolveAndAddToken, executeSwap, slippageBps]);

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
        <div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="section-title mb-6"
        >
          Swap
        </motion.h1>
        <div className="flex flex-wrap items-center gap-4 mb-8">
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="glass-card rounded-xl p-6">
              <TradingChart
                pairLabel={pairLabel}
                inputMint={chartBaseMint}
                quoteMint={chartQuoteMint}
                latestPriceFromQuote={latestPriceFromQuote}
                getSymbol={getSymbol}
              />
            </div>
          </div>

          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <ArrowDownLeft size={18} className="text-primary" />
              <h2 className="text-base font-semibold text-foreground">Swap</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">From</label>
                <div className="flex gap-2">
                    <TokenSelect
                    value={inputToken}
                    options={tokenOptions}
                    onSelect={setInputToken}
                    resolveCa={resolveAndAddToken}
                    getBalance={getBalanceForToken}
                    getSymbol={getSymbol}
                  />
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
                      Balance: {getBalanceForToken(inputToken).toLocaleString(undefined, { maximumFractionDigits: 6 })} {getSymbol(inputToken.mint)}
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
                    <TokenSelect
                    value={outputToken}
                    options={tokenOptions}
                    onSelect={setOutputToken}
                    resolveCa={resolveAndAddToken}
                    getBalance={getBalanceForToken}
                    getSymbol={getSymbol}
                  />
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
                      Balance: {getBalanceForToken(outputToken).toLocaleString(undefined, { maximumFractionDigits: 6 })} {getSymbol(outputToken.mint)}
                    </p>
                  </div>
                </div>
              </div>

              {resolveError && <p className="text-xs text-destructive">{resolveError}</p>}

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
                  onClick={() => void executeSwap()}
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
        </div>
      </main>
      <Footer />
    </div>
  );
}

