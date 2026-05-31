import { memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Variant Design Tokens ─────────────────────────────────────────────────────

const VARIANT_CONFIG = {
  ai: {
    accent: "#8B5CF6",           // neon-purple
    glow: "rgba(139,92,246,0.35)",
    glowStrong: "rgba(139,92,246,0.6)",
    glowClass: "glow-purple",
    borderColor: "rgba(139,92,246,0.3)",
    progressGradient: "linear-gradient(90deg, #8B5CF6, #A78BFA, #1E90FF)",
    labelColor: "text-neon-purple",
    bgBlob: "bg-neon-purple/15",
  },
  overview: {
    accent: "#1E90FF",
    glow: "rgba(30,144,255,0.35)",
    glowStrong: "rgba(30,144,255,0.6)",
    glowClass: "glow-blue",
    borderColor: "rgba(30,144,255,0.3)",
    progressGradient: "linear-gradient(90deg, #1E90FF, #3DBBFF)",
    labelColor: "text-neon-blue",
    bgBlob: "bg-neon-blue/15",
  },
  quality: {
    accent: "#06B6D4",
    glow: "rgba(6,182,212,0.35)",
    glowStrong: "rgba(6,182,212,0.6)",
    glowClass: "glow-blue",
    borderColor: "rgba(6,182,212,0.3)",
    progressGradient: "linear-gradient(90deg, #06B6D4, #22D3EE)",
    labelColor: "text-neon-cyan",
    bgBlob: "bg-neon-cyan/15",
  },
  metrics: {
    accent: "#10B981",
    glow: "rgba(16,185,129,0.35)",
    glowStrong: "rgba(16,185,129,0.6)",
    glowClass: "glow-green",
    borderColor: "rgba(16,185,129,0.3)",
    progressGradient: "linear-gradient(90deg, #10B981, #34D399)",
    labelColor: "text-neon-green",
    bgBlob: "bg-neon-green/15",
  },
  activity: {
    accent: "#EC4899", // neon-pink
    glow: "rgba(236,72,153,0.35)",
    glowStrong: "rgba(236,72,153,0.6)",
    glowClass: "glow-pink",
    borderColor: "rgba(236,72,153,0.3)",
    progressGradient: "linear-gradient(90deg, #EC4899, #F472B6)",
    labelColor: "text-neon-pink",
    bgBlob: "bg-neon-pink/15",
  },
  tree: {
    accent: "#EAB308", // yellow
    glow: "rgba(234,179,8,0.35)",
    glowStrong: "rgba(234,179,8,0.6)",
    glowClass: "glow-yellow",
    borderColor: "rgba(234,179,8,0.3)",
    progressGradient: "linear-gradient(90deg, #EAB308, #FDE047)",
    labelColor: "text-yellow-400",
    bgBlob: "bg-yellow-400/15",
  },
};

const SIZE_CONFIG = {
  sm: { container: "p-8 min-h-40", icon: "w-8 h-8", title: "text-base", subtitle: "text-xs" },
  md: { container: "p-12 min-h-64", icon: "w-12 h-12", title: "text-lg", subtitle: "text-sm" },
  lg: { container: "p-16 min-h-80", icon: "w-16 h-16", title: "text-xl", subtitle: "text-base" },
};

// ── Floating Particle ─────────────────────────────────────────────────────────

const Particle = memo(({ accent, delay, x, y, size }) => (
  <motion.div
    className="absolute rounded-full pointer-events-none"
    style={{
      width: size,
      height: size,
      left: `${x}%`,
      top: `${y}%`,
      background: accent,
      boxShadow: `0 0 ${size * 2}px ${accent}`,
    }}
    animate={{
      y: [0, -20, 0, -12, 0],
      x: [0, 8, -5, 3, 0],
      opacity: [0.2, 0.7, 0.3, 0.8, 0.2],
      scale: [1, 1.3, 0.8, 1.1, 1],
    }}
    transition={{
      duration: 4 + delay,
      delay,
      repeat: Infinity,
      ease: "easeInOut",
    }}
  />
));
Particle.displayName = "Particle";

// ── Progress Bar with Shimmer ─────────────────────────────────────────────────

const ProgressBar = memo(({ progress, gradient, accent }) => (
  <div
    className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden relative"
    role="progressbar"
    aria-valuenow={Math.round(progress)}
    aria-valuemin={0}
    aria-valuemax={100}
  >
    <motion.div
      className="h-full rounded-full relative overflow-hidden"
      style={{ background: gradient }}
      initial={{ width: "0%" }}
      animate={{ width: `${progress}%` }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Shimmer sweep */}
      <motion.div
        className="absolute inset-0 opacity-60"
        style={{
          background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)`,
          backgroundSize: "200% 100%",
        }}
        animate={{ backgroundPosition: ["-200% center", "200% center"] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
      />
    </motion.div>
  </div>
));
ProgressBar.displayName = "ProgressBar";

// ── Stage Text with AnimatePresence ──────────────────────────────────────────

const StageText = memo(({ stage, labelColor }) => (
  <AnimatePresence mode="wait">
    <motion.span
      key={stage}
      className={`font-medium text-xs ${labelColor}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.3 }}
    >
      {stage}
    </motion.span>
  </AnimatePresence>
));
StageText.displayName = "StageText";

// ── Main AnalysisLoader ───────────────────────────────────────────────────────

/**
 * AnalysisLoader
 *
 * A reusable cinematic loading component for all dashboard analysis states.
 *
 * @param {string}    title          - Main loading headline
 * @param {string}    subtitle       - Supporting description text
 * @param {number}    progress       - 0–100 progress value
 * @param {string}    status         - "pending" | "running" | "processing" | "active"
 * @param {ReactNode} icon           - Icon element to display (optional, variant default used)
 * @param {string}    variant        - "ai" | "overview" | "quality" | "metrics"
 * @param {string}    size           - "sm" | "md" | "lg"
 * @param {boolean}   animated       - Enable/disable Framer Motion animations
 * @param {string}    estimatedTime  - Human-readable time estimate (e.g. "~2 min")
 * @param {boolean}   showProgressBar - Show/hide the progress bar row
 * @param {boolean}   glowEffect     - Enable/disable ambient glow blob
 * @param {string[]}  stages         - Stage labels array
 * @param {number}    currentStageIndex - Active stage index
 * @param {string}    message        - Override stage text with socket message
 * @param {boolean}   timedOut       - Show "taking longer than expected" warning
 */
const AnalysisLoader = ({
  title = "Analyzing...",
  subtitle = "Please wait while we process your data.",
  progress = 0,
  status = "running",
  icon = null,
  variant = "ai",
  size = "md",
  animated = true,
  estimatedTime = "",
  showProgressBar = true,
  glowEffect = true,
  stages = [],
  currentStageIndex = 0,
  message = "",
  timedOut = false,
}) => {
  const cfg = VARIANT_CONFIG[variant] || VARIANT_CONFIG.ai;
  const szCfg = SIZE_CONFIG[size] || SIZE_CONFIG.md;

  const particles = useMemo(
    () =>
      animated
        ? [
            { x: 15, y: 25, size: 4, delay: 0 },
            { x: 80, y: 15, size: 3, delay: 1.2 },
            { x: 70, y: 75, size: 5, delay: 0.7 },
            { x: 20, y: 70, size: 3, delay: 1.8 },
            { x: 50, y: 10, size: 4, delay: 0.3 },
          ]
        : [],
    [animated]
  );

  const activeStage = message || (stages.length > 0 ? stages[currentStageIndex] : "");

  const Wrapper = animated ? motion.div : "div";
  const wrapperProps = animated
    ? {
        initial: { opacity: 0, scale: 0.97 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.97 },
        transition: { duration: 0.4, ease: "easeOut" },
      }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`glass-card ${szCfg.container} border text-center shadow-lg relative overflow-hidden flex flex-col items-center justify-center`}
      style={{ borderColor: cfg.borderColor }}
      aria-live="polite"
      aria-label={`Loading: ${title}`}
    >
      {/* Ambient glow blob */}
      {glowEffect && (
        <motion.div
          className={`absolute top-1/2 left-1/2 w-48 h-48 rounded-full pointer-events-none ${cfg.bgBlob}`}
          style={{
            transform: "translate(-50%, -50%)",
            filter: "blur(60px)",
          }}
          animate={animated ? { scale: [1, 1.2, 1], opacity: [0.5, 0.9, 0.5] } : {}}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Floating particles */}
      {particles.map((p, i) => (
        <Particle key={i} accent={cfg.accent} {...p} />
      ))}

      {/* Icon */}
      <div className="relative z-10 mb-5">
        {/* Pulsing glow ring */}
        {animated && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ boxShadow: `0 0 0 0 ${cfg.glow}` }}
            animate={{
              boxShadow: [
                `0 0 0 0 ${cfg.glowStrong}`,
                `0 0 0 16px rgba(0,0,0,0)`,
                `0 0 0 0 ${cfg.glowStrong}`,
              ],
            }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        {icon ? (
          <motion.div
            animate={animated ? { rotate: 360 } : {}}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
            className={`${szCfg.icon} flex items-center justify-center`}
            style={{ color: cfg.accent }}
          >
            {icon}
          </motion.div>
        ) : (
          <DefaultIconForVariant variant={variant} size={szCfg.icon} color={cfg.accent} animated={animated} />
        )}
      </div>

      {/* Title */}
      <motion.h3
        className={`font-semibold text-white relative z-10 ${szCfg.title}`}
        style={{ textShadow: `0 0 20px ${cfg.glow}` }}
        animate={animated ? { opacity: [0.85, 1, 0.85] } : {}}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      >
        {title}
      </motion.h3>

      {/* Subtitle */}
      <p className={`text-text-muted mt-1 relative z-10 max-w-xs ${szCfg.subtitle}`}>
        {subtitle}
      </p>

      {/* Progress bar + stage text */}
      {showProgressBar && (
        <div className="mt-6 flex flex-col items-center gap-2 relative z-10 w-full max-w-md px-2">
          <ProgressBar progress={progress} gradient={cfg.progressGradient} accent={cfg.accent} />

          <div className="flex justify-between w-full items-center mt-1">
            <StageText stage={activeStage || "Initializing..."} labelColor={cfg.labelColor} />
            <span className="text-xs text-text-muted tabular-nums font-medium">
              {Math.round(progress)}%
            </span>
          </div>

          {estimatedTime && (
            <p className="text-xs text-text-dim mt-0.5">
              Estimated: <span className={cfg.labelColor}>{estimatedTime}</span>
            </p>
          )}
        </div>
      )}

      {/* Timeout warning */}
      <AnimatePresence>
        {timedOut && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex items-center gap-2 text-xs text-yellow-400 relative z-10 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-2"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>This is taking longer than expected. Still running in the background.</span>
          </motion.div>
        )}
      </AnimatePresence>
    </Wrapper>
  );
};

// ── Default Icon per Variant ──────────────────────────────────────────────────

const DefaultIconForVariant = ({ variant, size, color, animated }) => {
  const iconClass = `${size} flex items-center justify-center`;

  const renderIcon = (children) =>
    animated ? (
      <motion.div
        className={iconClass}
        style={{ color }}
        animate={{ rotate: 360 }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
      >
        {children}
      </motion.div>
    ) : (
      <div className={iconClass} style={{ color }}>
        {children}
      </div>
    );

  // Always return a clean loading spinner icon that looks good while rotating
  return renderIcon(
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
};

export default memo(AnalysisLoader);
