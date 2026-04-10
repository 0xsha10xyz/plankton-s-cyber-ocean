import { PublicKey } from "@solana/web3.js";

/** Solana mint / account addresses are base58-encoded; length is typically 32–44 chars. */
export function mintValidationMessage(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.length < 32 || t.length > 44) {
    return "Paste the full mint address (32–44 characters). Partial copies will not work.";
  }
  try {
    new PublicKey(t);
    return null;
  } catch {
    return "Invalid Solana address (check for typos or extra spaces).";
  }
}

export function isValidMintString(raw: string): boolean {
  return mintValidationMessage(raw) === null;
}
