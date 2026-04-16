import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { base58 } from "@scure/base";
import { config } from "./config.js";

export function keypairFromBase58PrivateKey(pk: string): Keypair {
  const raw = base58.decode(pk);
  if (raw.length >= 64) return Keypair.fromSecretKey(raw.slice(0, 64));
  if (raw.length === 32) return Keypair.fromSeed(raw);
  throw new Error("SOLANA_PRIVATE_KEY must decode to 32-byte seed or 64-byte secret key");
}

/**
 * x402 exact-SVM builds TransferChecked from the payer's USDC ATA. Missing ATA or low USDC → Syraa often returns 402 "Invalid transaction".
 */
export async function warnIfMissingUsdcAta(): Promise<void> {
  try {
    const kp = keypairFromBase58PrivateKey(config.solana.privateKey);
    const mint = config.solana.usdcMint;
    const connection = new Connection(config.solana.rpcUrl, "confirmed");

    const lamports = await connection.getBalance(kp.publicKey);
    console.log(
      `[agent] Solana payer pubkey: ${kp.publicKey.toBase58()} (SOL balance: ${lamports} lamports ~ ${(lamports / 1e9).toFixed(6)} SOL)`
    );

    const ata = getAssociatedTokenAddressSync(new PublicKey(mint), kp.publicKey, false, TOKEN_PROGRAM_ID);
    const info = await connection.getAccountInfo(ata);
    if (!info) {
      console.warn(
        `[agent] No USDC SPL token account (ATA) yet. Mint ${mint} — send USDC to ${kp.publicKey.toBase58()} on mainnet so the ATA is created, then restart.`
      );
      return;
    }

    const tb = await connection.getTokenAccountBalance(ata);
    const raw = BigInt(tb.value.amount);
    const decimals = tb.value.decimals;
    console.log(`[agent] USDC ATA ${ata.toBase58()} | raw amount ${raw} (${decimals} decimals)`);

    const typicalCharge = 100_000n;
    if (raw < typicalCharge) {
      console.warn(
        `[agent] USDC balance looks below a typical Syraa charge (~${typicalCharge} raw = $0.10 with 6 decimals). Top up USDC on this ATA.`
      );
    }
  } catch (e) {
    console.warn("[agent] USDC ATA preflight skipped:", e instanceof Error ? e.message : String(e));
  }
}
