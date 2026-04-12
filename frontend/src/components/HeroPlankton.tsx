export default function HeroPlankton() {
  return (
    <div className="flex flex-col items-center max-w-4xl mx-auto">
      <p className="text-[11px] sm:text-xs font-semibold tracking-[0.28em] text-primary/75 uppercase mb-4">
        Autonomous protocol · Solana
      </p>
      <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mt-1 mb-5 tracking-[-0.04em] leading-[1.05]">
        <span className="bg-gradient-to-b from-white via-primary to-teal-500/85 bg-clip-text text-transparent drop-shadow-[0_0_40px_hsl(180_90%_50%/0.2)]">
          PLANKTON
        </span>
      </h1>

      <p className="text-lg sm:text-xl md:text-2xl text-foreground/95 font-semibold max-w-3xl mb-3 leading-snug tracking-tight">
        Advanced autonomous AI agents with a robust human oversight layer
      </p>

      <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-xl mb-2 leading-relaxed">
        The Autonomous Protocol — all execution on Solana.
      </p>
    </div>
  );
}
