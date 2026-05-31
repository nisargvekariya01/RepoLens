/**
 * RepoLens Logo Component
 * Renders the brand logo + wordmark with optional size and glow variants.
 */
const RepoLensLogo = ({ size = "md", showWordmark = true, className = "" }) => {
  const sizes = {
    xs: { img: 20, text: "text-sm", gap: "gap-1.5" },
    sm: { img: 28, text: "text-base", gap: "gap-2" },
    md: { img: 36, text: "text-xl", gap: "gap-2.5" },
    lg: { img: 52, text: "text-2xl", gap: "gap-3" },
    xl: { img: 72, text: "text-4xl", gap: "gap-4" },
    "2xl": { img: 100, text: "text-5xl", gap: "gap-5" },
  };

  const s = sizes[size] || sizes.md;

  return (
    <div className={`flex items-center ${s.gap} ${className}`}>
      <div className="relative flex-shrink-0">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(30,144,255,0.35) 0%, transparent 70%)",
            filter: "blur(8px)",
            transform: "scale(1.3)",
          }}
        />
        <img
          src="/repolens-logo.webp"
          alt="RepoLens"
          width={s.img}
          height={s.img}
          className="relative z-10 object-contain drop-shadow-[0_0_8px_rgba(30,144,255,0.7)]"
          style={{ imageRendering: "crisp-edges" }}
        />
      </div>

      {showWordmark && (
        <span
          className={`font-bold tracking-tight ${s.text} gradient-text-brand`}
          style={{ letterSpacing: "-0.02em" }}
        >
          RepoLens
        </span>
      )}
    </div>
  );
};

export default RepoLensLogo;
