import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Shared shimmer animation ──────────────────────────────────────────────────

const shimmerStyle = {
  background: "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)",
  backgroundSize: "200% 100%",
};

const ShimmerBlock = ({ className, style = {} }) => (
  <motion.div
    className={`rounded-lg ${className}`}
    style={{ ...shimmerStyle, ...style }}
    animate={{ backgroundPosition: ["-200% center", "200% center"] }}
    transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
    aria-hidden="true"
  />
);

// ── MetricCardSkeleton ────────────────────────────────────────────────────────

/**
 * Skeleton placeholder for a single metric stat card.
 * Matches the shape of cards in RepoMetricsDashboard.
 */
export const MetricCardSkeleton = memo(() => (
  <div className="glass-card p-5 flex flex-col gap-3" aria-label="Loading metric card">
    <div className="flex items-center justify-between">
      <ShimmerBlock className="h-3 w-24" />
      <ShimmerBlock className="h-6 w-6 rounded-full" />
    </div>
    <ShimmerBlock className="h-8 w-16 mt-1" />
    <ShimmerBlock className="h-2 w-full rounded-full" />
    <ShimmerBlock className="h-2.5 w-20" />
  </div>
));
MetricCardSkeleton.displayName = "MetricCardSkeleton";

// ── ChartSkeleton ─────────────────────────────────────────────────────────────

/**
 * Skeleton placeholder for a chart area (line/area/bar chart).
 * Used in Activity and Trends tabs.
 */
export const ChartSkeleton = memo(({ height = "h-48" }) => (
  <div className={`glass-card p-5 flex flex-col gap-3 ${height}`} aria-label="Loading chart">
    {/* Header */}
    <div className="flex items-center justify-between mb-2">
      <ShimmerBlock className="h-4 w-32" />
      <ShimmerBlock className="h-4 w-16" />
    </div>

    {/* Fake chart bars */}
    <div className="flex-1 flex items-end gap-1.5 px-2">
      {[60, 80, 45, 90, 70, 55, 85, 40, 75, 65, 50, 95].map((h, i) => (
        <motion.div
          key={i}
          className="flex-1 rounded-t-sm"
          style={{
            height: `${h}%`,
            ...shimmerStyle,
            animationDelay: `${i * 0.06}s`,
          }}
          animate={{ backgroundPosition: ["-200% center", "200% center"] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "linear", delay: i * 0.06 }}
          aria-hidden="true"
        />
      ))}
    </div>

    {/* X-axis labels */}
    <div className="flex gap-2 mt-1">
      {[...Array(6)].map((_, i) => (
        <ShimmerBlock key={i} className="h-2.5 flex-1" />
      ))}
    </div>
  </div>
));
ChartSkeleton.displayName = "ChartSkeleton";

// ── CodeQualitySkeleton ───────────────────────────────────────────────────────

/**
 * Skeleton matching the 2-column grid layout of RepoCodeQualityDashboard.
 */
export const CodeQualitySkeleton = memo(() => (
  <div className="space-y-6" aria-label="Loading code quality data">
    {/* Header */}
    <div className="border-b border-white/8 pb-4 flex items-center gap-3">
      <ShimmerBlock className="h-7 w-7 rounded-full" />
      <ShimmerBlock className="h-6 w-56" />
    </div>

    {/* 2-column grid */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Security card */}
      <div className="glass-card p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <ShimmerBlock className="h-5 w-5 rounded-full" />
          <ShimmerBlock className="h-4 w-40" />
        </div>
        <ShimmerBlock className="h-16 w-full rounded-lg" />
        <div className="grid grid-cols-2 gap-3">
          <ShimmerBlock className="h-20 w-full rounded-lg" />
          <ShimmerBlock className="h-20 w-full rounded-lg" />
        </div>
      </div>

      {/* Tech stack card */}
      <div className="glass-card p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <ShimmerBlock className="h-5 w-5 rounded-full" />
          <ShimmerBlock className="h-4 w-36" />
        </div>
        <ShimmerBlock className="h-40 w-40 rounded-full mx-auto" />
        <div className="grid grid-cols-3 gap-2">
          {[...Array(3)].map((_, i) => (
            <ShimmerBlock key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>

      {/* Churn table */}
      <div className="glass-card p-6 flex flex-col gap-3">
        <div className="flex items-center gap-2 mb-2">
          <ShimmerBlock className="h-5 w-5 rounded-full" />
          <ShimmerBlock className="h-4 w-32" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5">
            <ShimmerBlock className="h-3.5 w-40" />
            <ShimmerBlock className="h-2 w-16 rounded-full" />
          </div>
        ))}
      </div>

      {/* Complexity table */}
      <div className="glass-card p-6 flex flex-col gap-3">
        <div className="flex items-center gap-2 mb-2">
          <ShimmerBlock className="h-5 w-5 rounded-full" />
          <ShimmerBlock className="h-4 w-36" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5">
            <ShimmerBlock className="h-3.5 w-40" />
            <ShimmerBlock className="h-2 w-16 rounded-full" />
          </div>
        ))}
      </div>

      {/* Commit patterns - full width */}
      <div className="glass-card p-6 lg:col-span-2 flex flex-col gap-4">
        <div className="flex items-center gap-2 mb-2">
          <ShimmerBlock className="h-5 w-5 rounded-full" />
          <ShimmerBlock className="h-4 w-48" />
        </div>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-5">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <ShimmerBlock className="h-3 w-40" />
                  <ShimmerBlock className="h-3 w-10" />
                </div>
                <ShimmerBlock className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
          <div className="flex-1 grid grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <ShimmerBlock className="h-7 w-10 rounded-md" />
                <ShimmerBlock className="h-2.5 w-8" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
));
CodeQualitySkeleton.displayName = "CodeQualitySkeleton";

// ── OverviewSkeleton ──────────────────────────────────────────────────────────

/**
 * Skeleton matching the 2/3 + 1/3 grid layout of the Overview tab.
 */
export const OverviewSkeleton = memo(() => (
  <div className="space-y-6" aria-label="Loading overview data">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Main column */}
      <div className="lg:col-span-2 space-y-6">
        {/* Trend chart */}
        <ChartSkeleton height="h-56" />

        {/* Recommendations */}
        <div className="space-y-3">
          <ShimmerBlock className="h-5 w-52 mb-1" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card p-4 flex items-start gap-3">
              <ShimmerBlock className="h-5 w-5 rounded-full shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <ShimmerBlock className="h-3.5 w-3/4" />
                <ShimmerBlock className="h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Health score card */}
        <div className="glass-card p-6 flex flex-col gap-4">
          <ShimmerBlock className="h-4 w-32" />
          <div className="flex items-center justify-center">
            <ShimmerBlock className="h-24 w-24 rounded-full" />
          </div>
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <ShimmerBlock className="h-2.5 w-24" />
                <ShimmerBlock className="h-2.5 w-12" />
              </div>
            ))}
          </div>
        </div>

        {/* Recent jobs */}
        <div className="glass-card p-6 flex flex-col gap-3">
          <ShimmerBlock className="h-4 w-36 mb-1" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex justify-between items-center py-1.5 border-b border-white/5">
              <ShimmerBlock className="h-3.5 w-20" />
              <ShimmerBlock className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
));
OverviewSkeleton.displayName = "OverviewSkeleton";

// ── Skeleton Fade-in Wrapper ──────────────────────────────────────────────────

/**
 * Wraps any skeleton in a smooth fade-in animation.
 * Also handles the fade-out → content-fade-in transition.
 *
 * Usage:
 *   <SkeletonTransition isLoading={loading}>
 *     <SkeletonComponent />         // shown while loading
 *     <ActualContent />             // shown when not loading
 *   </SkeletonTransition>
 */
export const SkeletonTransition = memo(({ isLoading, children }) => {
  const [skeleton, content] = Array.isArray(children) ? children : [children, null];
  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {skeleton}
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {content || skeleton}
        </motion.div>
      )}
    </AnimatePresence>
  );
});
SkeletonTransition.displayName = "SkeletonTransition";

// ── MetricsSkeleton ───────────────────────────────────────────────────────────
export const MetricsSkeleton = memo(() => (
  <div className="space-y-6" aria-label="Loading metrics data">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => <MetricCardSkeleton key={i} />)}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ChartSkeleton height="h-64" />
      <ChartSkeleton height="h-64" />
    </div>
  </div>
));
MetricsSkeleton.displayName = "MetricsSkeleton";

// ── ActivitySkeleton ──────────────────────────────────────────────────────────
export const ActivitySkeleton = memo(() => (
  <div className="space-y-6" aria-label="Loading activity data">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-6">
        <ChartSkeleton height="h-72" />
      </div>
      <div className="glass-card p-6 flex flex-col gap-4">
        <ShimmerBlock className="h-5 w-32" />
        <ShimmerBlock className="h-40 w-40 rounded-full mx-auto" />
        <div className="grid grid-cols-2 gap-2 mt-2">
          {[...Array(4)].map((_, i) => <ShimmerBlock key={i} className="h-8 w-full" />)}
        </div>
      </div>
    </div>
  </div>
));
ActivitySkeleton.displayName = "ActivitySkeleton";

// ── AISkeleton ──────────────────────────────────────────────────────────────
export const AISkeleton = memo(() => (
  <div className="space-y-6" aria-label="Loading AI analysis">
    <div className="glass-card p-6 flex flex-col gap-4">
      <ShimmerBlock className="h-6 w-48" />
      <ShimmerBlock className="h-4 w-full" />
      <ShimmerBlock className="h-4 w-5/6" />
      <ShimmerBlock className="h-4 w-4/6" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="glass-card p-6 flex flex-col gap-3">
          <ShimmerBlock className="h-5 w-32" />
          <ShimmerBlock className="h-20 w-full" />
        </div>
      ))}
    </div>
  </div>
));
AISkeleton.displayName = "AISkeleton";

// ── TreeSkeleton ─────────────────────────────────────────────────────────────
export const TreeSkeleton = memo(() => (
  <div className="glass-card flex flex-col relative overflow-hidden h-[500px]" aria-label="Loading tree data">
    <div className="flex justify-between items-center px-6 py-4 border-b border-white/10">
      <ShimmerBlock className="h-5 w-40" />
      <ShimmerBlock className="h-8 w-32 rounded-md" />
    </div>
    <div className="p-6 flex flex-col gap-3">
      <ShimmerBlock className="h-4 w-32" />
      <ShimmerBlock className="h-4 w-48 ml-6" />
      <ShimmerBlock className="h-4 w-40 ml-12" />
      <ShimmerBlock className="h-4 w-56 ml-12" />
      <ShimmerBlock className="h-4 w-36 ml-6" />
      <ShimmerBlock className="h-4 w-44 ml-12" />
    </div>
  </div>
));
TreeSkeleton.displayName = "TreeSkeleton";
