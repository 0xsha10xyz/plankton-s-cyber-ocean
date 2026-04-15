export type UsageComponent = "info" | "chat";

export type UsageRecord = {
  wallet: string;
  info_used_count: number;
  chat_used_count: number;
  info_paid_blocks: number; // blocks of 10
  chat_paid_blocks: number; // blocks of 5
  updated_at: string; // ISO
};

export type UsageDecision = {
  allowed: boolean;
  remainingInBlock: number;
  requiresPayment: boolean;
  /**
   * For x402 clients: send this back as the 402 JSON body. The browser x402 client
   * will read it and create + sign the payment transaction.
   */
  paymentRequest?: unknown;
  /**
   * Helpful for debugging/UX; do not rely on this for logic.
   */
  reason?: string;
};

