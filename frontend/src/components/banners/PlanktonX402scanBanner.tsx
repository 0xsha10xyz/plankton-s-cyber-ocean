import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

/** Same visual language as {@link PlanktonXBanner}: Plankton lockup · x402scan listing (for docs / previews). */
export function PlanktonX402scanBanner({ className }: Props): JSX.Element {
  return (
    <div
      className={cn(
        "relative aspect-[15/4] max-h-[min(420px,42vw)] w-full max-w-[2400px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#020203] shadow-[0_0_80px_-30px_rgba(255,255,255,0.08)]",
        className,
      )}
      role="img"
      aria-label="Plankton and x402scan — ecosystem discovery"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(45,212,191,0.06),transparent_55%)]" />
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1200 400"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        aria-hidden
      >
        <g stroke="white" strokeOpacity={0.07} strokeWidth="0.9" fill="none">
          <path d="M0 45 C200 20 400 70 600 50s400-30 600-20" />
          <path d="M0 78 C250 55 450 95 700 72s350-40 500-32" />
          <path d="M0 115 C300 90 500 130 800 100s300-45 400-38" />
          <path d="M0 152 C180 130 420 168 650 140s350-50 550-42" />
          <path d="M0 190 C220 175 480 210 750 185s300-35 450-30" />
          <path d="M0 228 C280 200 520 250 900 220s200-30 320-25" />
          <path d="M0 268 C200 255 500 290 750 270s350-20 450-15" />
          <path d="M0 308 C320 290 600 330 900 300s200-12 300-8" />
          <path d="M0 345 C400 320 800 360 1200 340" />
        </g>
      </svg>

      <div className="relative px-5 py-8 sm:px-10 sm:py-10 md:px-12 md:py-11">
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-stretch md:grid-cols-[1fr_auto_1fr] md:gap-0">
          <div className="flex flex-col items-center justify-center text-center md:px-2">
            <div className="relative mb-5 md:mb-6">
              <div
                className="pointer-events-none absolute -inset-4 rounded-full bg-[#22d3ee]/20 blur-3xl"
                aria-hidden
              />
              <img
                src="/brand/plankton-token-logo.png"
                alt="Plankton"
                width={112}
                height={112}
                className="relative h-[104px] w-[104px] rounded-full object-cover shadow-[0_0_40px_rgba(34,211,238,0.45)] ring-[3px] ring-[#67e8f9]/90 ring-offset-[3px] ring-offset-[#020203] md:h-[118px] md:w-[118px]"
                draggable={false}
              />
            </div>
            <h2 className="font-sans text-[1.35rem] font-bold uppercase tracking-[0.14em] text-[#C6FAF5] md:text-[1.65rem]">
              PLANKTON
            </h2>
            <p className="mt-3 max-w-[24rem] px-1 font-sans text-[13px] font-normal leading-relaxed text-white md:text-[15px] md:leading-relaxed">
              The Autonomous Protocol · Agent Chat on Solana
            </p>
          </div>

          <div className="relative hidden py-2 md:flex md:w-px md:items-stretch md:justify-center" aria-hidden>
            <span className="relative h-full min-h-[240px] w-full">
              <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white to-transparent opacity-90 shadow-[0_0_16px_2px_rgba(255,255,255,0.45)]" />
            </span>
          </div>
          <div
            className="mx-auto my-8 h-px w-full max-w-[220px] bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-90 shadow-[0_0_12px_rgba(255,255,255,0.35)] md:hidden"
            aria-hidden
          />

          <div className="flex flex-col items-center justify-center text-center md:px-2">
            <div className="relative mb-5 md:mb-6">
              <div
                className="relative flex h-[104px] w-[104px] items-center justify-center overflow-hidden rounded-2xl bg-white p-2 md:h-[118px] md:w-[118px]"
                style={{
                  boxShadow:
                    "0 0 0 1px rgba(255,255,255,0.14), 0 12px 40px -12px rgba(0,0,0,0.9)",
                }}
              >
                <img
                  src="/brand/x402scan-logo.png"
                  alt="x402scan"
                  width={104}
                  height={104}
                  className="h-full w-full object-contain"
                  draggable={false}
                />
              </div>
            </div>
            <h2 className="font-sans text-[1.55rem] font-bold tracking-tight md:text-[1.75rem]">
              <span className="text-white">x402</span>
              <span className="text-sky-400">scan</span>
            </h2>
            <p className="mt-2 font-sans text-[13px] text-slate-300 md:text-[15px]">
              Listed · HTTP 402 discovery
            </p>
          </div>
        </div>

        <div className="mt-10 border-t border-white/[0.07] pt-6 text-center">
          <p className="font-sans text-[13px] tracking-wide text-white/75">
            <span className="text-white/55">Explore the ecosystem at </span>
            <a
              href="https://www.x402scan.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-sky-300 underline-offset-4 transition-colors hover:text-white hover:underline"
            >
              x402scan.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
