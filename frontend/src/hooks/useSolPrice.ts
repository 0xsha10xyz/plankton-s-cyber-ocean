import { useEffect, useState } from "react";
import { SOL_PRICE_INTERVAL_MS } from "@/lib/commandCenter/constants";

export function useSolPrice(): number {
  const [price, setPrice] = useState(0);

  useEffect(() => {
    const load = (): void => {
      fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd")
        .then((r) => r.json())
        .then((d: unknown) => {
          if (d && typeof d === "object" && "solana" in d) {
            const sol = (d as { solana?: { usd?: unknown } }).solana;
            const usd = sol?.usd;
            if (typeof usd === "number" && Number.isFinite(usd)) setPrice(usd);
          }
        })
        .catch(() => {});
    };
    load();
    const id = window.setInterval(load, SOL_PRICE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return price;
}
