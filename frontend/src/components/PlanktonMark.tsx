type PlanktonMarkProps = {
  size?: number;
  className?: string;
  title?: string;
};

export function PlanktonMark({ size = 40, className, title = "Plankton" }: PlanktonMarkProps) {
  const s = Math.max(16, Math.round(size));
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={className}
    >
      <defs>
        <radialGradient id="ringGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(32 32) rotate(90) scale(30)">
          <stop stopColor="#64FFE6" stopOpacity="0.95" />
          <stop offset="1" stopColor="#18D7C9" stopOpacity="0.45" />
        </radialGradient>
        <radialGradient id="bodyGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(30 34) rotate(120) scale(22 16)">
          <stop stopColor="#B8FFF3" stopOpacity="0.9" />
          <stop offset="1" stopColor="#1AAFA6" stopOpacity="0.25" />
        </radialGradient>
      </defs>

      {/* Outer ring */}
      <circle cx="32" cy="32" r="26" stroke="url(#ringGlow)" strokeWidth="3.5" opacity="0.95" />
      <circle cx="32" cy="32" r="26" stroke="#64FFE6" strokeWidth="1" opacity="0.25" />

      {/* Organism body */}
      <path
        d="M39.5 18.5c5.4 4.7 6.8 15.2 2.7 23.2-3.8 7.4-12 13-19.1 11.3-6.8-1.6-10.5-10.1-8.9-18.2 1.8-8.7 10.1-20.7 25.3-16.3Z"
        fill="url(#bodyGlow)"
        stroke="#7CFFF0"
        strokeOpacity="0.6"
        strokeWidth="1.2"
      />

      {/* Inner lines (subtle segmentation) */}
      {[
        "M27 25.5c5.8 1.6 10.3 1 14.6-1.9",
        "M24.5 31c6.8 2.1 13.2 1.2 18-2.4",
        "M24 36.5c6.5 1.8 12.7 1 17.2-2.2",
        "M25.5 42c5.2 1.1 9.8.5 13.3-1.6",
      ].map((d) => (
        <path key={d} d={d} stroke="#9DFFF5" strokeOpacity="0.35" strokeWidth="0.9" strokeLinecap="round" />
      ))}

      {/* Spines */}
      {[
        { x1: 38, y1: 24, x2: 46, y2: 20 },
        { x1: 41, y1: 28, x2: 50, y2: 26 },
        { x1: 42, y1: 33, x2: 51, y2: 34 },
        { x1: 40, y1: 38, x2: 49, y2: 42 },
        { x1: 36, y1: 44, x2: 44, y2: 51 },
        { x1: 28, y1: 46, x2: 24, y2: 56 },
        { x1: 23, y1: 42, x2: 16, y2: 50 },
        { x1: 21, y1: 37, x2: 12, y2: 39 },
        { x1: 21, y1: 31, x2: 12, y2: 28 },
        { x1: 24, y1: 26, x2: 16, y2: 20 },
      ].map((l, i) => (
        <line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke="#7CFFF0"
          strokeOpacity="0.45"
          strokeWidth="1"
          strokeLinecap="round"
        />
      ))}

      {/* Small bubbles */}
      {[
        { cx: 18, cy: 22, r: 1.6, o: 0.45 },
        { cx: 14.5, cy: 28.5, r: 1.1, o: 0.35 },
        { cx: 17.2, cy: 34.2, r: 0.9, o: 0.25 },
        { cx: 47, cy: 44, r: 1.8, o: 0.35 },
      ].map((b, i) => (
        <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill="#64FFE6" opacity={b.o} />
      ))}
    </svg>
  );
}

