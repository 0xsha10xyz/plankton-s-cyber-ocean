type Props = {
  className?: string;
};

const ParticleBackground = ({ className }: Props) => {
  return (
    <div
      aria-hidden="true"
      className={[
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden",
        "[mask-image:radial-gradient(1200px_800px_at_50%_25%,black,transparent)]",
        className ?? "",
      ].join(" ")}
    >
      {/* Aurora / mesh */}
      <div className="absolute -inset-[35%] opacity-[0.42] bg-[radial-gradient(ellipse_58%_38%_at_14%_18%,hsl(217_91%_62%/0.11),transparent_54%),radial-gradient(ellipse_55%_34%_at_82%_16%,hsl(181_78%_48%/0.1),transparent_50%),radial-gradient(ellipse_44%_28%_at_42%_88%,hsl(158_84%_52%/0.07),transparent_54%)] animate-aurora-shift" />

      {/* Fine dots */}
      <div className="absolute inset-0 opacity-[0.28] bg-[radial-gradient(hsl(215_15%_50%/0.09)_1px,transparent_1px)] [background-size:20px_20px]" />

      {/* Subtle vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(222_47%_4%/0)_0%,hsl(222_44%_4%/0.62)_62%,hsl(222_47%_3%/0.92)_100%)]" />
    </div>
  );
};

export default ParticleBackground;
