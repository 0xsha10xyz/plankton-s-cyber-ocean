export function formatUSD(value: number, opts?: { compact?: boolean; maximumFractionDigits?: number }) {
  const compact = opts?.compact ?? true;
  const maximumFractionDigits = opts?.maximumFractionDigits ?? 2;

  if (!Number.isFinite(value)) return "$—";

  if (compact) {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `$${Math.round(value / 1_000).toFixed(0)}K`;
  }

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
  });
}

