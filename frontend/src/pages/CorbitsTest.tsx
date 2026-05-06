import { useMemo, useState } from "react";
import { wrap, WrappedFetchError } from "@faremeter/fetch";
import { createPaymentHandler } from "@faremeter/payment-solana/exact";
import type { Wallet as FaremeterSolanaWallet } from "@faremeter/payment-solana/exact";
import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { toast } from "sonner";
import { useUnifiedSolanaWallet } from "@/hooks/useUnifiedSolanaWallet";
import { withX402RpcFallback } from "@/lib/solana-rpc";

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function maxPaymentAtomic(expected: bigint): bigint {
  if (expected <= 0n) return 1_000_000n;
  return expected * 25n;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === "object";
}

function pickSolanaAccept(body: unknown): { network: string; maxAmountRequired: bigint } | null {
  if (!isRecord(body)) return null;
  const accepts = body.accepts;
  if (!Array.isArray(accepts)) return null;
  for (const a of accepts) {
    if (!isRecord(a)) continue;
    const scheme = String(a.scheme ?? "").toLowerCase();
    const network = String(a.network ?? "");
    const max = String(a.maxAmountRequired ?? "");
    if (scheme !== "exact") continue;
    if (!network.toLowerCase().includes("solana")) continue;
    try {
      return { network, maxAmountRequired: BigInt(max) };
    } catch {
      continue;
    }
  }
  return null;
}

function pickSolanaUsdcMint(body: unknown): string | null {
  // Prefer canonical SPL USDC (EPjF...); fall back to first solana accept asset.
  const CANONICAL_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  if (!isRecord(body)) return null;
  const accepts = body.accepts;
  if (!Array.isArray(accepts)) return null;
  for (const a of accepts) {
    if (!isRecord(a)) continue;
    if (String(a.asset ?? "") === CANONICAL_USDC) return CANONICAL_USDC;
  }
  for (const a of accepts) {
    if (!isRecord(a)) continue;
    const network = String(a.network ?? "");
    if (!network.toLowerCase().includes("solana")) continue;
    const asset = String(a.asset ?? "");
    if (asset) return asset;
  }
  return null;
}

async function waitForSignature(opts: {
  connection: Connection;
  signature: string;
  timeoutMs: number;
  pollMs?: number;
}): Promise<void> {
  const pollMs = opts.pollMs ?? 1500;
  const start = Date.now();
  while (Date.now() - start < opts.timeoutMs) {
    const { value } = await opts.connection.getSignatureStatuses([opts.signature], { searchTransactionHistory: true });
    const s = value?.[0];
    if (s?.err) throw new Error(`Transaction failed: ${JSON.stringify(s.err)}`);
    // Consider confirmed if it reached "confirmed" or "finalized".
    if (s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized") return;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error("Transaction was not confirmed in time");
}

export default function CorbitsTest() {
  const BUILD_MARKER = "corbits-payflow-v5";
  const [url, setUrl] = useState(
    "https://planktonomous.0xsha10-xyz.api.corbits.dev/api/v1/status",
  );
  const [useDevProxy, setUseDevProxy] = useState(true);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [raw, setRaw] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [lastPaymentHeader, setLastPaymentHeader] = useState<string>("");

  const wallet = useUnifiedSolanaWallet();
  const parsed = useMemo(() => safeJsonParse(raw), [raw]);
  const parsedSummary = useMemo(() => {
    if (!isRecord(parsed)) return "—";
    const accepts = Array.isArray(parsed.accepts) ? parsed.accepts.length : 0;
    return `x402Version=${String(parsed.x402Version ?? "?")}, accepts=${accepts}`;
  }, [parsed]);

  function buildTarget(u: string): string {
    const parsedUrl = new URL(u);
    return useDevProxy
      ? `/__corbits${parsedUrl.pathname}${parsedUrl.search}`
      : parsedUrl.toString();
  }

  function rewriteToDevProxy(input: RequestInfo | URL): RequestInfo | URL {
    if (!useDevProxy) return input;
    const s = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    // Only rewrite Corbits proxy calls; leave relative URLs untouched.
    if (typeof s === "string" && s.startsWith("https://") && s.includes(".api.corbits.dev/")) {
      const u = new URL(s);
      return `/__corbits${u.pathname}${u.search}`;
    }
    return input;
  }

  async function runPlain() {
    setLoading(true);
    setError("");
    setStatus(null);
    setRaw("");
    setLastPaymentHeader("");

    try {
      const res = await fetch(buildTarget(url), {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      setStatus(res.status);
      setRaw(await res.text());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function runWithPayment() {
    if (!wallet.connected || !wallet.publicKey) {
      toast.error("Connect a Solana wallet first (Phantom/Solflare).");
      return;
    }
    if (!wallet.signTransaction) {
      toast.error("This wallet cannot sign transactions, so it cannot pay via x402.");
      return;
    }

    setLoading(true);
    setError("");
    setStatus(null);
    setRaw("");
    setLastPaymentHeader("");

    try {
      const rawFetch = globalThis.fetch.bind(globalThis);
      const customFetch: typeof fetch = async (input, init) => {
        const rewritten = rewriteToDevProxy(input);
        if (!init?.headers) return rawFetch(rewritten, init);
        const h = new Headers(init.headers as HeadersInit);
        // Debug: detect payment headers on phase-2 retry.
        const hasXPayment = h.has("X-PAYMENT") || h.has("x-payment");
        const hasV2 = h.has("PAYMENT-SIGNATURE") || h.has("payment-signature");
        if (hasV2) setLastPaymentHeader("PAYMENT-SIGNATURE");
        else if (hasXPayment) setLastPaymentHeader("X-PAYMENT");
        return rawFetch(rewritten, { ...init, headers: h });
      };

      const res = await withX402RpcFallback(async (rpcUrl) => {
        // Phase 1: fetch requirements explicitly so we can map network correctly.
        const phase1 = await customFetch(url, { method: "GET", headers: { Accept: "application/json" } });
        const phase1Text = await phase1.text();
        const phase1Body = safeJsonParse(phase1Text);
        // Surface phase-1 response in the UI for debugging.
        setStatus(phase1.status);
        setRaw(phase1Text);
        const accept = pickSolanaAccept(phase1Body);
        const mintStr = pickSolanaUsdcMint(phase1Body);
        if (!accept) {
          let sample = "";
          try {
            if (isRecord(phase1Body) && Array.isArray(phase1Body.accepts)) {
              const items = (phase1Body.accepts as unknown[]).slice(0, 3).map((x) => {
                if (!isRecord(x)) return { scheme: "?", network: "?", maxAmountRequired: "?" };
                return {
                  scheme: String(x.scheme ?? "?"),
                  network: String(x.network ?? "?"),
                  maxAmountRequired: String(x.maxAmountRequired ?? "?"),
                };
              });
              sample = ` sample_accepts=${JSON.stringify(items)}`;
            }
          } catch {
            // ignore
          }
          const hint =
            phase1Text && phase1Text.length > 0
              ? ` (phase1 status=${phase1.status}, body starts with: ${JSON.stringify(phase1Text.slice(0, 140))})`
              : ` (phase1 status=${phase1.status}, empty body)`;
          throw new Error(`No suitable Solana payment requirements found${hint}${sample}`);
        }
        if (!mintStr) {
          throw new Error("Could not determine Solana payment asset (mint) from 402 response");
        }
        const mint = new PublicKey(mintStr);

        const connection = new Connection(rpcUrl, { commitment: "confirmed" });
        const fmWallet: FaremeterSolanaWallet = {
          network: accept.network,
          publicKey: wallet.publicKey!,
          partiallySignTransaction: async (tx) => wallet.signTransaction!(tx),
          updateTransaction: async (tx) => wallet.signTransaction!(tx),
          sendTransaction: async (tx) => {
            // Prefer wallet-adapter sendTransaction when available.
            if (wallet.sendTransaction) {
              const sig = await wallet.sendTransaction(tx, connection, { skipPreflight: false, maxRetries: 3 });
              await waitForSignature({ connection, signature: sig, timeoutMs: 120_000 });
              return sig;
            }
            const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
            await waitForSignature({ connection, signature: sig, timeoutMs: 120_000 });
            return sig;
          },
        };

        // Use ToSpec mode (base64 transaction payload) for maximum compatibility with Corbits.
        const handler = createPaymentHandler(fmWallet, mint, connection, {
          features: { enableSettlementAccounts: false },
        });
        const paidFetch = wrap(customFetch, {
          handlers: [handler],
          returnPaymentFailure: false,
        });

        // Use the real Corbits URL as the logical resource; customFetch rewrites it to dev proxy.
        return paidFetch(url, { method: "GET", headers: { Accept: "application/json" } });
      });

      setStatus(res.status);
      const txt = await res.text();
      setRaw(txt);
      setError("");
      if (res.ok) toast.success("Paid request succeeded.");
      else if (res.status === 402) toast.error("Payment required: wallet did not complete payment flow.");
    } catch (e) {
      if (e instanceof WrappedFetchError) {
        const body = await e.response.text().catch(() => "");
        setStatus(e.response.status);
        setRaw(body);
        setError(`${e.message} (final HTTP ${e.response.status})`);
        return;
      }
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Corbits proxy test (browser)</h1>
      <div style={{ opacity: 0.7, marginBottom: 12 }}>
        <code>{BUILD_MARKER}</code>
      </div>
      <p style={{ opacity: 0.85, marginBottom: 16 }}>
        This makes a plain browser <code>fetch</code> call. If the endpoint is paywalled, you&apos;ll likely see{" "}
        <code>402</code> with x402 requirements. A payment-capable client is needed to complete the paid request.
      </p>

      <label style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, opacity: 0.9 }}>
        <input
          type="checkbox"
          checked={useDevProxy}
          onChange={(e) => setUseDevProxy(e.target.checked)}
        />
        Use Vite dev proxy (avoids CORS on localhost)
      </label>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://.../api/v1/status"
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(0,0,0,0.25)",
          }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={runPlain}
            disabled={loading || !url.trim()}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: loading ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.12)",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Running…" : "Fetch"}
          </button>
          <button
            onClick={runWithPayment}
            disabled={loading || !url.trim()}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(46, 204, 113, 0.12)",
              cursor: loading ? "not-allowed" : "pointer",
            }}
            title={wallet.connected ? "Approve payment in your wallet" : "Connect wallet first"}
          >
            Pay & Fetch
          </button>
        </div>
      </div>

      {error ? (
        <div style={{ color: "#ffb4b4", marginBottom: 12 }}>
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      {status !== null ? (
        <div style={{ marginBottom: 12 }}>
          <strong>Status:</strong> <code>{status}</code>
          <span style={{ marginLeft: 10, opacity: 0.8 }}>
            Wallet:{" "}
            <code>{wallet.publicKey ? `${wallet.publicKey.toBase58().slice(0, 4)}…${wallet.publicKey.toBase58().slice(-4)}` : "not connected"}</code>
          </span>
          <span style={{ marginLeft: 10, opacity: 0.8 }}>
            Parsed: <code>{parsedSummary}</code>
          </span>
          <span style={{ marginLeft: 10, opacity: 0.8 }}>
            Payment header: <code>{lastPaymentHeader || "—"}</code>
          </span>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            padding: 12,
            background: "rgba(0,0,0,0.25)",
            overflow: "auto",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Response (raw)</div>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{raw || "—"}</pre>
        </div>

        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            padding: 12,
            background: "rgba(0,0,0,0.25)",
            overflow: "auto",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Response (parsed JSON)</div>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {parsed ? JSON.stringify(parsed, null, 2) : "—"}
          </pre>
        </div>
      </div>
    </div>
  );
}

