import { motion } from "framer-motion";

type AIStatus = "researching" | "profitable" | "risk";

const statusColors: Record<AIStatus, { eye: string; glow: string }> = {
  researching: { eye: "hsl(200, 90%, 55%)", glow: "0 0 20px hsl(200 90% 55% / 0.6)" },
  profitable: { eye: "hsl(140, 80%, 50%)", glow: "0 0 20px hsl(140 80% 50% / 0.6)" },
  risk: { eye: "hsl(0, 80%, 55%)", glow: "0 0 20px hsl(0 80% 55% / 0.6)" },
};

const PlanktonLogo = ({ status = "researching", size = 48 }: { status?: AIStatus; size?: number }) => {
  const { eye, glow } = statusColors[status];

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Body */}
      <motion.ellipse
        cx="32"
        cy="36"
        rx="18"
        ry="22"
        fill="hsl(180, 60%, 15%)"
        stroke="hsl(180, 90%, 50%)"
        strokeWidth="1.5"
        style={{ filter: `drop-shadow(${glow})` }}
      />
      {/* Antenna left */}
      <motion.path
        d="M22 18 Q18 6 14 4"
        stroke="hsl(180, 90%, 50%)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Antenna right */}
      <motion.path
        d="M42 18 Q46 6 50 4"
        stroke="hsl(180, 90%, 50%)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Antenna tips */}
      <circle cx="14" cy="4" r="2" fill="hsl(180, 90%, 50%)" opacity="0.8" />
      <circle cx="50" cy="4" r="2" fill="hsl(180, 90%, 50%)" opacity="0.8" />
      {/* Eye socket */}
      <ellipse cx="32" cy="30" rx="10" ry="9" fill="hsl(220, 60%, 8%)" stroke="hsl(180, 90%, 40%)" strokeWidth="1" />
      {/* Eye */}
      <motion.circle
        cx="32"
        cy="30"
        r="6"
        fill={eye}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        style={{ filter: `drop-shadow(${glow})` }}
      />
      {/* Pupil */}
      <circle cx="33" cy="29" r="2.5" fill="hsl(220, 80%, 6%)" />
      {/* Eye highlight */}
      <circle cx="34" cy="28" r="1" fill="white" opacity="0.8" />
      {/* Legs */}
      {[-12, -6, 0, 6, 12].map((offset, i) => (
        <motion.line
          key={i}
          x1={26 + (i < 3 ? 0 : 12)}
          y1={44 + Math.abs(offset) * 0.3}
          x2={i < 3 ? 16 + i * 2 : 48 - (4 - i) * 2}
          y2={56 + Math.abs(offset) * 0.2}
          stroke="hsl(180, 70%, 35%)"
          strokeWidth="1.2"
          strokeLinecap="round"
          animate={{ y2: [56 + Math.abs(offset) * 0.2, 58 + Math.abs(offset) * 0.2, 56 + Math.abs(offset) * 0.2] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
        />
      ))}
    </motion.svg>
  );
};

export default PlanktonLogo;
