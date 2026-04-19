/**
 * Syraa API (signal + brain) with HTTP 402 / x402 v2.
 *
 * HTTP transport: PAYMENT-SIGNATURE (base64 JSON PaymentPayload). Solana `exact` SVM:
 * ComputeBudget → TransferChecked → Memo per Coinbase scheme_exact_svm.md.
 * Secrets only in backend `.env`.
 */
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { createTransferCheckedInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { base58 } from "@scure/base";
import { createWalletClient, http, type WalletClient } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

export type SyraaSignalParams = {
  token: string;
  source: string;
  instId: string;
  bar: string;
  limit: number;
};

export function normalizeSyraaApiBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  try {
    const u = new URL(trimmed);
    if (u.hostname === "api.syraa.fun" && u.protocol === "https:") {
      u.protocol = "http:";
      return u.href.replace(/\/+$/, "");
    }
  } catch {
    /* ignore */
  }
  return trimmed;
}

function buildQuery(params: SyraaSignalParams): string {
  const qs = new URLSearchParams({
    token: params.token,
    source: params.source,
    instId: params.instId,
    bar: params.bar,
    limit: String(params.limit),
  });
  const s = qs.toString();
  return s ? `?${s}` : "";
}

function hasSolanaKey(): boolean {
  return Boolean(process.env.SYRAA_SOLANA_PRIVATE_KEY?.trim());
}

function hasEvmKey(): boolean {
  return Boolean(process.env.SYRAA_EVM_PRIVATE_KEY?.trim());
}

function tryEvmFirst(): boolean {
  const v = process.env.SYRAA_TRY_EVM_FIRST?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function isSyraaSignalConfigured(): boolean {
  return hasSolanaKey() || hasEvmKey();
}

export function isSyraBrainConfigured(): boolean {
  return isSyraaSignalConfigured();
}

function solanaPayToTrusted(): string {
  return process.env.SYRAA_SIGNAL_PAY_TO?.trim() || "53JhuF8bgxvUQ59nDG6kWs4awUQYCS3wswQmUsV5uC7t";
}

function evmPayToTrusted(): string {
  return process.env.SYRAA_SIGNAL_PAY_TO_BASE?.trim() || "0xF9dcBFF7EdDd76c58412fd46f4160c96312ce734";
}

function defaultSolanaFeePayer(): string {
  return process.env.SYRAA_SOLANA_FEE_PAYER?.trim() || "AepWpq3GQwL8CeKMtZyKtKPa7W91Coygh3ropAJapVdU";
}

function maxPaymentAtomic(): bigint {
  const raw =
    process.env.SYRAA_SIGNAL_MAX_PAYMENT_ATOMIC?.trim() ||
    process.env.SYRAA_MAX_PAYMENT_AMOUNT?.trim() ||
    process.env.SYRAA_SIGNAL_COST_ATOMIC?.trim() ||
    "100000";
  if (!/^\d+$/.test(raw)) return 100000n;
  try {
    return BigInt(raw);
  } catch {
    return 100000n;
  }
}

function getSolanaRpcUrl(): string {
  return (
    process.env.SYRAA_SOLANA_RPC_URL?.trim() ||
    process.env.SYRAA_RPC_URL?.trim() ||
    process.env.SOLANA_RPC_URL?.trim() ||
    "https://api.mainnet-beta.solana.com"
  );
}

function getBaseRpcUrl(): string {
  return process.env.SYRAA_EVM_RPC_URL?.trim() || process.env.SYRAA_BASE_RPC_URL?.trim() || "https://mainnet.base.org";
}

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

type PaymentRequirements = {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
};

type PaymentRequiredBody = {
  x402Version?: number;
  error?: string;
  resource?: { url: string; description?: string; mimeType?: string };
  accepts?: PaymentRequirements[];
};

function payToOkSolana(trusted: string, payTo: string): boolean {
  return payTo === trusted;
}

function payToOkEvm(trusted: string, payTo: string): boolean {
  return payTo.toLowerCase() === trusted.toLowerCase();
}

function randomMemoHex(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Buffer.from(b).toString("hex");
}

function getSolanaKeypair(): Keypair {
  const pk = process.env.SYRAA_SOLANA_PRIVATE_KEY?.trim();
  if (!pk) throw new Error("SYRAA_SOLANA_PRIVATE_KEY is not set");
  return Keypair.fromSecretKey(base58.decode(pk));
}

let _evmAccount: PrivateKeyAccount | null = null;
let _evmWallet: WalletClient | null = null;

function getEvmAccount(): PrivateKeyAccount {
  if (!_evmAccount) {
    const raw = process.env.SYRAA_EVM_PRIVATE_KEY?.trim();
    if (!raw) throw new Error("SYRAA_EVM_PRIVATE_KEY is not set");
    const hex = (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
    _evmAccount = privateKeyToAccount(hex);
  }
  return _evmAccount;
}

function getEvmWalletClient(): WalletClient {
  if (!_evmWallet) {
    _evmWallet = createWalletClient({
      account: getEvmAccount(),
      chain: base,
      transport: http(getBaseRpcUrl()),
    });
  }
  return _evmWallet;
}

function mergeResource(reqUrl: string, pr: PaymentRequiredBody): { url: string; description: string; mimeType: string } {
  const r = pr.resource;
  if (r?.url) {
    return {
      url: r.url,
      description: typeof r.description === "string" ? r.description : "Syraa API",
      mimeType: typeof r.mimeType === "string" ? r.mimeType : "application/json",
    };
  }
  return { url: reqUrl, description: "Syraa API", mimeType: "application/json" };
}

async function parsePaymentRequired(res: Response): Promise<PaymentRequiredBody> {
  const header =
    res.headers.get("payment-required") ?? res.headers.get("PAYMENT-REQUIRED") ?? res.headers.get("Payment-Required");
  if (header?.trim()) {
    return JSON.parse(Buffer.from(header.trim(), "base64").toString("utf8")) as PaymentRequiredBody;
  }
  const text = await res.text();
  try {
    return JSON.parse(text) as PaymentRequiredBody;
  } catch {
    throw new Error(`Syraa 402 body is not JSON: ${text.slice(0, 500)}`);
  }
}

async function buildSolanaPaymentPayload(
  accept: PaymentRequirements,
  resource: { url: string; description: string; mimeType: string }
): Promise<{ x402Version: number; resource: typeof resource; accepted: PaymentRequirements; payload: { transaction: string } }> {
  const trustedPayTo = solanaPayToTrusted();
  if (!payToOkSolana(trustedPayTo, accept.payTo)) {
    throw new Error(`Untrusted Syraa Solana payTo: ${accept.payTo}`);
  }
  const amount = BigInt(accept.amount);
  const cap = maxPaymentAtomic();
  if (amount > cap) {
    throw new Error(`Syraa payment ${amount.toString()} exceeds configured max (${cap.toString()} atomic)`);
  }

  const mint = new PublicKey(accept.asset);
  const payToOwner = new PublicKey(accept.payTo);
  const feePayerStr =
    (typeof accept.extra?.feePayer === "string" && accept.extra.feePayer.trim()) || defaultSolanaFeePayer();
  const feePayer = new PublicKey(feePayerStr);

  const kp = getSolanaKeypair();
  const connection = new Connection(getSolanaRpcUrl(), "confirmed");

  const sourceAta = getAssociatedTokenAddressSync(mint, kp.publicKey, false, TOKEN_PROGRAM_ID);
  const destAta = getAssociatedTokenAddressSync(mint, payToOwner, false, TOKEN_PROGRAM_ID);

  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  const memoStr =
    typeof accept.extra?.memo === "string" && accept.extra.memo.length > 0
      ? accept.extra.memo.slice(0, 256)
      : randomMemoHex();
  const memoIx = new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memoStr, "utf8"),
  });

  const transferIx = createTransferCheckedInstruction(
    sourceAta,
    mint,
    destAta,
    kp.publicKey,
    amount,
    6,
    [],
    TOKEN_PROGRAM_ID
  );

  const ixs = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1n }),
    transferIx,
    memoIx,
  ];

  const messageV0 = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: ixs,
  }).compileToV0Message();

  const vtx = new VersionedTransaction(messageV0);
  vtx.sign([kp]);

  const txB64 = Buffer.from(vtx.serialize()).toString("base64");

  return {
    x402Version: 2,
    resource,
    accepted: accept,
    payload: { transaction: txB64 },
  };
}

async function buildEvmPaymentPayload(
  accept: PaymentRequirements,
  resource: { url: string; description: string; mimeType: string }
): Promise<{
  x402Version: number;
  resource: typeof resource;
  accepted: PaymentRequirements;
  payload: { signature: `0x${string}`; authorization: Record<string, string> };
}> {
  const trustedPayTo = evmPayToTrusted();
  if (!payToOkEvm(trustedPayTo, accept.payTo)) {
    throw new Error(`Untrusted Syraa EVM payTo: ${accept.payTo}`);
  }
  const amount = BigInt(accept.amount);
  const cap = maxPaymentAtomic();
  if (amount > cap) {
    throw new Error(`Syraa payment ${amount.toString()} exceeds configured max (${cap.toString()} atomic)`);
  }

  const account = getEvmAccount();
  const client = getEvmWalletClient();
  const usdc = accept.asset as `0x${string}`;
  const payTo = accept.payTo as `0x${string}`;

  const now = BigInt(Math.floor(Date.now() / 1000));
  const validAfter = 0n;
  const validBefore = now + 120n;
  const nonceBytes = new Uint8Array(32);
  crypto.getRandomValues(nonceBytes);
  const nonce = `0x${Buffer.from(nonceBytes).toString("hex")}` as `0x${string}`;

  const domain = {
    name: typeof accept.extra?.name === "string" ? accept.extra.name : "USD Coin",
    version: typeof accept.extra?.version === "string" ? accept.extra.version : "2",
    chainId: 8453,
    verifyingContract: usdc,
  } as const;

  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  } as const;

  const message = {
    from: account.address,
    to: payTo,
    value: amount,
    validAfter,
    validBefore,
    nonce,
  };

  const signature = await client.signTypedData({
    account,
    domain,
    types,
    primaryType: "TransferWithAuthorization",
    message,
  });

  const authorization = {
    from: account.address,
    to: accept.payTo,
    value: amount.toString(),
    validAfter: validAfter.toString(),
    validBefore: validBefore.toString(),
    nonce,
  };

  return {
    x402Version: 2,
    resource,
    accepted: accept,
    payload: { signature, authorization },
  };
}

function paymentSignatureHeader(payload: object): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

async function fetchWithOptionalPayment(
  url: string,
  init: RequestInit,
  externalSignal: AbortSignal | undefined,
  opts: { label: string }
): Promise<Response> {
  const first = await fetch(url, { ...init, signal: externalSignal });
  if (first.status !== 402) return first;

  const pr = await parsePaymentRequired(first);
  const accepts = pr.accepts ?? [];
  if (!accepts.length) {
    throw new Error("Syraa 402: no accepts[] in payment challenge");
  }

  const resource = mergeResource(url, pr);
  const sol = accepts.find((a) => a.scheme === "exact" && a.network.startsWith("solana:"));
  const evm = accepts.find((a) => a.scheme === "exact" && a.network.startsWith("eip155:"));

  const trySol = hasSolanaKey() && sol;
  const tryEvm = hasEvmKey() && evm;

  const order: Array<{ kind: "solana" | "evm"; accept: PaymentRequirements }> = [];
  if (tryEvmFirst()) {
    if (tryEvm && evm) order.push({ kind: "evm", accept: evm });
    if (trySol && sol) order.push({ kind: "solana", accept: sol });
  } else {
    if (trySol && sol) order.push({ kind: "solana", accept: sol });
    if (tryEvm && evm) order.push({ kind: "evm", accept: evm });
  }

  if (!order.length) {
    throw new Error("No usable payment method: set SYRAA_SOLANA_PRIVATE_KEY and/or SYRAA_EVM_PRIVATE_KEY");
  }

  const errors: string[] = [];
  for (const { kind, accept } of order) {
    try {
      const payload =
        kind === "solana"
          ? await buildSolanaPaymentPayload(accept, resource)
          : await buildEvmPaymentPayload(accept, resource);
      const payHeader = paymentSignatureHeader(payload);
      const headers = new Headers(init.headers ?? {});
      headers.set("PAYMENT-SIGNATURE", payHeader);
      headers.set("Accept", "application/json");
      console.log(`[syraa] ${opts.label}: retry with x402 ${kind} payment`);
      const second = await fetch(url, {
        ...init,
        headers,
        signal: externalSignal,
      });
      if (second.ok) return second;
      const errText = await second.text().catch(() => "");
      errors.push(`${kind}: HTTP ${second.status} ${errText.slice(0, 400)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${kind}: ${msg}`);
    }
  }

  throw new Error(`Syraa x402 payment failed:\n${errors.join("\n")}`);
}

async function paidJson(
  url: string,
  init: Omit<RequestInit, "signal">,
  externalSignal?: AbortSignal
): Promise<unknown> {
  const res = await fetchWithOptionalPayment(
    url,
    { ...init },
    externalSignal,
    { label: new URL(url).pathname }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Syraa API HTTP ${res.status}: ${body.slice(0, 4000)}`);
  }
  return (await res.json()) as unknown;
}

export async function fetchSyraaSignal(params: SyraaSignalParams, externalSignal?: AbortSignal): Promise<unknown> {
  const signalApiUrl = process.env.SYRAA_SIGNAL_API_URL?.trim() || "http://api.syraa.fun/signal";
  const base = normalizeSyraaApiBaseUrl(signalApiUrl);
  const url = `${base}${buildQuery(params)}`;

  return paidJson(
    url,
    {
      method: "GET",
      headers: { accept: "application/json" },
    },
    externalSignal
  );
}

export type SyraBrainResult = {
  raw: unknown;
  answer: string;
};

export async function fetchSyraBrain(question: string, signal?: AbortSignal): Promise<SyraBrainResult> {
  const brainUrl = process.env.SYRAA_BRAIN_API_URL?.trim() || "http://api.syraa.fun/brain";
  const url = normalizeSyraaApiBaseUrl(brainUrl);
  const raw = await paidJson(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ question: question.slice(0, 8000) }),
    },
    signal
  );

  const o = raw as Record<string, unknown>;
  const answer =
    typeof o?.response === "string"
      ? o.response
      : typeof o?.answer === "string"
        ? o.answer
        : JSON.stringify(raw);

  return { raw, answer };
}
