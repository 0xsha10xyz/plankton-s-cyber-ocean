import { verifyMessage } from "viem";

export async function verifyEvmWalletMessage(
  wallet: string,
  message: string,
  signature: string
): Promise<boolean> {
  const w = wallet.trim().toLowerCase();
  const sig = signature.trim();
  if (!w.startsWith("0x") || w.length < 42 || !sig.startsWith("0x")) return false;
  try {
    const ok = await verifyMessage({
      address: w as `0x${string}`,
      message,
      signature: sig as `0x${string}`,
    });
    return ok;
  } catch {
    return false;
  }
}
