type Integration = {
  name: string;
  role: string;
  logoUrl: string;
};

const INTEGRATIONS: Integration[] = [
  {
    name: "Solana",
    role: "Base layer for all protocol activity, swaps, and agent execution.",
    logoUrl: "/logos/solana.png",
  },
  {
    name: "Jupiter",
    role: "Routing engine for swap quotes and execution across Solana DEXs.",
    logoUrl: "/logos/jupiter.png",
  },
  {
    name: "Birdeye",
    role: "Real-time OHLCV and market data powering charts and research.",
    logoUrl: "/logos/birdeye.png",
  },
  {
    name: "CoinGecko",
    role: "Fallback pricing and historical data for SOL and other assets.",
    logoUrl: "/logos/coingecko.png",
  },
  {
    name: "Helius",
    role: "RPC and webhook infrastructure for on-chain events and agent feeds.",
    logoUrl: "/logos/helius.png",
  },
  {
    name: "Phantom",
    role: "Primary wallet integration for connecting users to Plankton.",
    logoUrl: "/logos/phantom.png",
  },
  {
    name: "OKX Wallet",
    role: "Wallet for connecting and swapping on Solana via OKX Wallet.",
    logoUrl: "/logos/okx-wallet.png",
  },
  {
    name: "Solflare",
    role: "Wallet for connecting and swapping on Solana via Solflare.",
    logoUrl: "/logos/solflare.png",
  },
  {
    name: "Ankr",
    role: "Default Solana RPC fallback for wallet balances and swaps.",
    logoUrl: "/logos/ankr.png",
  },
];

export function IntegrationsSection() {
  const items = [...INTEGRATIONS, ...INTEGRATIONS];
  return (
    <section aria-labelledby="partners-title" className="container mx-auto px-4">
      <div className="text-center mb-10">
        <p className="text-[11px] font-semibold tracking-[0.3em] text-muted-foreground uppercase">
          Ecosystem
        </p>
        <h2 id="partners-title" className="section-title section-title--center mt-3 md:text-[1.85rem]">
          Partners &amp; Integrations
        </h2>
        <p className="mt-3 text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
          Plankton integrates with leading Solana protocols and data providers to deliver institutional grade
          intelligence and execution.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-border/30 bg-gradient-to-b from-secondary/20 to-transparent shadow-surface-sm">
        {/* Edge fades */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-24 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-24 bg-gradient-to-l from-background to-transparent z-10" />

        <div className="marquee marquee--rtl py-2">
          <div className="marquee__track">
            {items.map((item, idx) => (
              <div
                key={`${item.name}-${idx}`}
                className="marquee__item rounded-2xl bg-secondary/40 border border-border/40 px-3 py-4 md:px-4 md:py-5 flex flex-col items-center gap-3 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
              >
                <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-secondary/60 flex items-center justify-center shadow-[0_0_24px_rgba(0,0,0,0.7)] overflow-hidden">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
                    <img
                      src={item.logoUrl}
                      alt={`${item.name} logo`}
                      className="max-w-full max-h-full object-contain"
                      loading="lazy"
                      draggable={false}
                    />
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs md:text-sm font-semibold text-foreground whitespace-nowrap">{item.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default IntegrationsSection;

