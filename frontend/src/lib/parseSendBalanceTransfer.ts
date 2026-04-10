/**
 * Parse Agent Chat "Send balance" paste: TOKEN (may be multiple words) amount recipient.
 * Supports amount glued to the start of a base58 address (e.g. "20000GJRT...") — common paste mistake.
 */
export function parseSendBalanceTransferInput(
  raw: string,
  detectBase58: (text: string) => string[]
): { tokenSymbolInput: string; amountInput: string; recipient: string } {
  const cleaned = raw.replace(/,/g, " ").replace(/\+/g, " ").trim();
  const recipientMatches = detectBase58(cleaned);
  if (!recipientMatches.length) {
    throw new Error("Recipient address is missing");
  }
  const recipient = recipientMatches[recipientMatches.length - 1];
  const idx = cleaned.lastIndexOf(recipient);
  if (idx === -1) {
    throw new Error("Recipient address is missing");
  }

  let beforeRecipient = cleaned.slice(0, idx).trim();
  if (!beforeRecipient) {
    throw new Error("Paste: token name, amount, then recipient address");
  }

  const parts = beforeRecipient.split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    throw new Error("Paste: token name, amount, then recipient address");
  }

  const amountInput = parts[parts.length - 1];
  if (!/^\d+(\.\d+)?$/.test(amountInput)) {
    throw new Error(
      'Invalid amount format. Use digits (e.g. 20000 or 1.5), with a space before the wallet address. Example: Plankton Autonomous Protocol 20000 GJRT...'
    );
  }

  const tokenSymbolInput = parts.slice(0, -1).join(" ").trim();
  if (!tokenSymbolInput) {
    throw new Error("Token name is missing");
  }

  return { tokenSymbolInput, amountInput, recipient };
}
