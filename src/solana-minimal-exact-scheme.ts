import type {
  PaymentPayloadContext,
  PaymentPayloadResult,
  PaymentRequirements,
  SchemeNetworkClient
} from "@x402/core/types";
import { createTransferCheckedInstruction, getAssociatedTokenAddress, getMint } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";

const MAX_SIGN_MS = 30_000;

/** Last partially-signed wire tx (base64) for debugging 402 Invalid transaction from the resource server. */
let lastSolanaPaymentTxBase64: string | null = null;

export function getLastSolanaPaymentTxBase64(): string | null {
  return lastSolanaPaymentTxBase64;
}

export function clearLastSolanaPaymentTxBase64(): void {
  lastSolanaPaymentTxBase64 = null;
}

/**
 * Minimal Solana "exact" x402 client: single SPL `transferChecked` in a legacy `Transaction`,
 * fee payer from `accepts[].extra.feePayer`, partial sign with the agent only.
 * Omits compute-budget + memo extras that some verifiers reject.
 */
export class MinimalExactSvmScheme implements SchemeNetworkClient {
  readonly scheme = "exact" as const;

  constructor(
    private readonly agentKeypair: Keypair,
    private readonly rpcUrl: string
  ) {}

  async createPaymentPayload(
    x402Version: number,
    paymentRequirements: PaymentRequirements,
    _context?: PaymentPayloadContext
  ): Promise<PaymentPayloadResult> {
    if (paymentRequirements.scheme !== "exact") {
      throw new Error(`Unsupported scheme: ${paymentRequirements.scheme}`);
    }

    const feePayerRaw = paymentRequirements.extra?.["feePayer"];
    if (typeof feePayerRaw !== "string" || !feePayerRaw.trim()) {
      throw new Error("feePayer is required in paymentRequirements.extra for SVM transactions");
    }

    const connection = new Connection(this.rpcUrl, "confirmed");
    const blockhashFetchedAt = Date.now();

    const { blockhash } = await connection.getLatestBlockhash("confirmed");

    const usdcMint = new PublicKey(paymentRequirements.asset);
    const payToOwner = new PublicKey(paymentRequirements.payTo);
    const feePayerPubkey = new PublicKey(feePayerRaw.trim());

    const mintInfo = await getMint(connection, usdcMint);
    const decimals = mintInfo.decimals;

    const senderATA = await getAssociatedTokenAddress(usdcMint, this.agentKeypair.publicKey);
    const recipientATA = await getAssociatedTokenAddress(usdcMint, payToOwner);

    const amount = BigInt(paymentRequirements.amount);
    const transferIx = createTransferCheckedInstruction(
      senderATA,
      usdcMint,
      recipientATA,
      this.agentKeypair.publicKey,
      amount,
      decimals
    );

    const tx = new Transaction();
    tx.feePayer = feePayerPubkey;
    tx.recentBlockhash = blockhash;
    tx.add(transferIx);

    tx.partialSign(this.agentKeypair);

    if (Date.now() - blockhashFetchedAt > MAX_SIGN_MS) {
      throw new Error("Took too long to sign — blockhash may be stale, retrying");
    }

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });
    const base64Tx = Buffer.from(serialized).toString("base64");
    lastSolanaPaymentTxBase64 = base64Tx;

    if (process.env["X402_DEBUG_SOLANA_TX"]?.trim() === "1") {
      console.error("[solana-minimal-exact-scheme] partial tx base64:", base64Tx);
    }

    return {
      x402Version,
      payload: {
        transaction: base64Tx
      }
    };
  }
}
