import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { base58 } from "@scure/base";
import { config } from "./config.js";

function keypairFromBase58PrivateKey(pk: string): Keypair {
  const raw = base58.decode(pk);
  if (raw.length >= 64) return Keypair.fromSecretKey(raw.slice(0, 64));
  if (raw.length === 32) return Keypair.fromSeed(raw);
  throw new Error("SOLANA_PRIVATE_KEY must decode to 32-byte seed or 64-byte secret key");
}

/**
 * x402 exact-SVM builds a TransferChecked from the payer's USDC ATA. If the ATA does not exist, Syraa returns 402 with error like "Invalid transaction".
 */
export async function warnIfMissingUsdcAta(): Promise<void> {
  if (config.paymentNetwork === "base") return;

  try {
    const kp = keypairFromBase58PrivateKey(config.solana.privateKey);
    const mint = config.solana.usdcMint;
    const connection = new Connection(config.solana.rpcUrl, "confirmed");
    const ata = getAssociatedTokenAddressSync(new PublicKey(mint), kp.publicKey, false, TOKEN_PROGRAM_ID);
    const info = await connection.getAccountInfo(ata);
    if (!info) {
      console.warn(
        `[agent] No USDC SPL token account (ATA) for this wallet. Create one by receiving USDC (mainnet, mint ${mint}) to ${kp.publicKey.toBase58()}, then restart. Otherwise x402 payments fail with "Invalid transaction".`
      );
    }
  } catch (e) {
    console.warn("[agent] USDC ATA preflight skipped:", e instanceof Error ? e.message : String(e));
  }
}
