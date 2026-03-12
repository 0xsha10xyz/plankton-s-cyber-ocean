import { motion } from "framer-motion";
import PlanktonLogo from "@/components/PlanktonLogo";

const PLANKTON_SIZE = 192;

export default function HeroPlankton() {
  return (
    <div className="flex flex-col items-center">
      {/* Plankton only – slightly enlarged, gentle float */}
      <div className="relative flex items-center justify-center min-h-[200px] md:min-h-[280px]">
        <motion.div
          className="relative z-10 flex items-end justify-center"
          style={{ paddingBottom: "8%" }}
          animate={{
            y: [0, -6, 0],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <PlanktonLogo status="researching" size={PLANKTON_SIZE} noPulse />
        </motion.div>
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
        Combining advanced autonomous AI agents with a robust human oversight layer
      </motion.p>

      <p className="text-sm text-muted-foreground/80 max-w-lg mb-8">
        The Autonomous Protocol — All on Solana.
      </p>
    </div>
  );
}
