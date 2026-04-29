import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, createTransferInstruction } from "@solana/spl-token";
import type { Env } from "../config/env.js";

export interface SolanaService {
  getPayerPublicKey(): string;
  transferUsdc(params: { recipient: string; amountUsdc: number; mint: string }): Promise<{ signature: string }>;
  broadcastSolanaTx(signedTx: Buffer): Promise<{ signature: string }>;
}

function parseKeypairFromEnv(envValue: string): Keypair {
  // Accept JSON array of bytes OR base58? For strictness: JSON array only.
  const parsed = JSON.parse(envValue) as unknown;
  if (!Array.isArray(parsed) || parsed.some((n) => typeof n !== "number")) {
    throw new Error("SOLANA_WALLET_PRIVATE_KEY must be a JSON array of numbers");
  }
  const secret = Uint8Array.from(parsed as number[]);
  return Keypair.fromSecretKey(secret);
}

export function createSolanaService(env: Env): SolanaService {
  const connection = new Connection(env.SOLANA_RPC_URL, "confirmed");
  const payer = parseKeypairFromEnv(env.SOLANA_WALLET_PRIVATE_KEY);

  async function ensureAtaIxs(mint: PublicKey, owner: PublicKey, payerPk: PublicKey): Promise<{ ata: PublicKey; ixs: ReturnType<typeof createAssociatedTokenAccountInstruction>[] }> {
    const ata = await getAssociatedTokenAddress(mint, owner);
    const info = await connection.getAccountInfo(ata);
    if (info) return { ata, ixs: [] };
    return {
      ata,
      ixs: [
        createAssociatedTokenAccountInstruction(
          payerPk, // fee payer
          ata,
          owner,
          mint,
        ),
      ],
    };
  }

  return {
    getPayerPublicKey: () => payer.publicKey.toBase58(),
    transferUsdc: async ({ recipient, amountUsdc, mint }) => {
      const mintPk = new PublicKey(mint);
      const recipientPk = new PublicKey(recipient);

      const { ata: payerAta, ixs: payerAtaIxs } = await ensureAtaIxs(mintPk, payer.publicKey, payer.publicKey);
      const { ata: recipientAta, ixs: recipientAtaIxs } = await ensureAtaIxs(mintPk, recipientPk, payer.publicKey);

      const decimals = 6; // devnet USDC
      const amount = BigInt(Math.round(amountUsdc * Math.pow(10, decimals)));

      const ix = createTransferInstruction(payerAta, recipientAta, payer.publicKey, amount);
      const tx = new Transaction().add(...payerAtaIxs, ...recipientAtaIxs, ix);
      tx.feePayer = payer.publicKey;
      const latest = await connection.getLatestBlockhash("finalized");
      tx.recentBlockhash = latest.blockhash;

      const sig = await connection.sendTransaction(tx, [payer], { skipPreflight: false, preflightCommitment: "confirmed" });
      await connection.confirmTransaction({ signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight }, "confirmed");
      return { signature: sig };
    },

    broadcastSolanaTx: async (signedTx: Buffer) => {
      const signature = await connection.sendRawTransaction(signedTx, { skipPreflight: false, preflightCommitment: "confirmed" });
      await connection.confirmTransaction(signature, "confirmed");
      return { signature };
    },
  };
}

