import { motion } from "framer-motion";
import PlanktonLogo from "@/components/PlanktonLogo";

const PATTY_WIDTH = 120;
const PATTY_HEIGHT = 84;

/**
 * Crabby Patty – larger, clearer burger with bun, patty, lettuce, seeds
 */
function CrabbyPattyIcon() {
  return (
    <svg
      width={PATTY_WIDTH}
      height={PATTY_HEIGHT}
      viewBox="0 0 120 84"
      fill="none"
      className="drop-shadow-lg"
    >
      <defs>
        <linearGradient id="bun-top" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(38, 72%, 72%)" />
          <stop offset="100%" stopColor="hsl(35, 58%, 52%)" />
        </linearGradient>
        <linearGradient id="bun-bottom" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="hsl(36, 55%, 48%)" />
          <stop offset="100%" stopColor="hsl(38, 65%, 62%)" />
        </linearGradient>
        <linearGradient id="patty-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(28, 45%, 38%)" />
          <stop offset="50%" stopColor="hsl(22, 50%, 28%)" />
          <stop offset="100%" stopColor="hsl(25, 48%, 32%)" />
        </linearGradient>
        <filter id="patty-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="hsl(0,0%,0%)" floodOpacity="0.3" />
        </filter>
      </defs>
      {/* Top bun */}
      <ellipse cx="60" cy="18" rx="54" ry="18" fill="url(#bun-top)" />
      <ellipse cx="60" cy="14" rx="48" ry="14" fill="hsl(40, 75%, 78%)" />
      {/* Sesame seeds */}
      {[18, 36, 54, 72, 90, 102].map((x, i) => (
        <ellipse key={i} cx={x} cy={i % 2 === 0 ? 8 : 11} rx="5" ry="2.5" fill="hsl(48, 35%, 88%)" />
      ))}
      {/* Lettuce */}
      <path
        d="M12 38 Q30 28 60 32 Q90 28 108 38 Q100 48 60 44 Q20 48 12 38"
        fill="hsl(135, 40%, 42%)"
        stroke="hsl(132, 35%, 35%)"
        strokeWidth="1"
      />
      {/* Patty */}
      <rect x="12" y="42" width="96" height="24" rx="6" fill="url(#patty-grad)" filter="url(#patty-shadow)" />
      <rect x="14" y="44" width="92" height="20" rx="4" fill="hsl(28, 42%, 32%)" />
      {/* Bottom bun */}
      <ellipse cx="60" cy="66" rx="54" ry="18" fill="url(#bun-bottom)" />
      <ellipse cx="60" cy="70" rx="48" ry="14" fill="hsl(34, 52%, 45%)" />
    </svg>
  );
}

const CHEW_DURATION = 1.8;

export default function HeroPlankton() {
  return (
    <div className="flex flex-col items-center">
      {/* Large scene: Plankton + Crabby Patty */}
      <div className="relative flex items-center justify-center min-h-[200px] md:min-h-[260px]">
        {/* Plankton – bigger, with chew squash and eye blink */}
        <motion.div
          className="relative z-10 flex items-end justify-center"
          style={{ paddingBottom: "8%" }}
          animate={{
            scaleY: [1, 1.08, 1],
            scaleX: [1, 0.97, 1],
          }}
          transition={{
            duration: CHEW_DURATION,
            repeat: Infinity,
            ease: [0.4, 0, 0.2, 1],
          }}
        >
          <PlanktonLogo status="researching" size={160} noPulse />
        </motion.div>

        {/* Crabby Patty – in front, big; moves toward him then back (bite cycle) */}
        <motion.div
          className="absolute z-0"
          style={{
            left: "50%",
            top: "58%",
            marginLeft: -PATTY_WIDTH / 2 + 20,
            marginTop: -PATTY_HEIGHT / 2,
          }}
          initial={{ opacity: 1 }}
          animate={{
            x: [0, -28, 0],
            y: [0, 8, 0],
            scale: [1, 0.88, 1],
            rotate: [0, -4, 0],
          }}
          transition={{
            duration: CHEW_DURATION,
            repeat: Infinity,
            ease: [0.4, 0, 0.2, 1],
          }}
        >
          <CrabbyPattyIcon />
        </motion.div>

        {/* Bite sparkle – appears at "chomp" moment */}
        <div
          className="absolute pointer-events-none z-20"
          style={{ left: "50%", top: "46%", transform: "translateX(-50%)" }}
        >
          <motion.span
            className="inline-block text-4xl md:text-5xl"
            aria-hidden
            animate={{
              opacity: [0, 0, 0.9, 0],
              scale: [0.5, 0.5, 1.2, 1.5],
            }}
            transition={{
              duration: CHEW_DURATION,
              repeat: Infinity,
              ease: "easeOut",
            }}
          >
            ✨
          </motion.span>
        </div>
      </div>

      <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mt-4 mb-3 tracking-tight">
        <span className="glow-text text-primary">PLANKTON</span>
      </h1>

      <motion.p
        className="text-lg md:text-xl text-primary/95 font-medium max-w-2xl mb-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        Hi, I&apos;m Plankton your AI agent & I like Crabby Patties
      </motion.p>

      <p className="text-sm text-muted-foreground/80 max-w-lg mb-8">
        The Autonomous Protocol — All on Solana.
      </p>
    </div>
  );
}
