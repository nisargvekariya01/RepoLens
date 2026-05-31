import { useState, useRef, useCallback, useEffect } from "react";

/**
 * useJobProgressTracker
 *
 * A progress tracker that chases a "target" percentage using exponential easing.
 * Designed for real job-status-driven loading where the backend periodically
 * reports job state (queued → pending → running → completed).
 *
 * Instead of simulating progress on a timer, the consumer calls setTarget()
 * whenever the job status changes to advance toward a known milestone:
 *
 *   queued  → setTarget(10)
 *   pending → setTarget(30)
 *   running → setTarget(75)
 *   done    → complete()   // snaps to 100% immediately
 *
 * The bar chases the target smoothly so it never looks "stuck", but it also
 * never lies — it won't pass the milestone until the server says so.
 *
 * @param {boolean} active - Start/stop the tracker
 * @returns {{ progress, stageIndex, setTarget, setStageIndex, complete, reset }}
 */
export function useJobProgressTracker(active = false) {
  const [progress, setProgress]     = useState(0);
  const [stageIndex, setStageIndex] = useState(0);

  const targetRef  = useRef(0);
  const tickRef    = useRef(null);
  const isActive   = useRef(active);

  useEffect(() => { isActive.current = active; }, [active]);

  const stopTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  // Move progress toward the current target at 200ms intervals.
  // Uses exponential easing: step = max(1, 15% of remaining distance)
  // → fast at first, gradually decelerates near the target.
  const startTick = useCallback(() => {
    stopTick();
    tickRef.current = setInterval(() => {
      if (!isActive.current) return;
      setProgress(prev => {
        const target = targetRef.current;
        if (prev >= target) return prev;
        const step = Math.max(1, Math.ceil((target - prev) * 0.15));
        return Math.min(prev + step, target);
      });
    }, 200);
  }, [stopTick]);

  // Set a new milestone — the bar will chase toward it
  const setTarget = useCallback((pct) => {
    targetRef.current = pct;
  }, []);

  // Snap to 100% and stop
  const complete = useCallback(() => {
    stopTick();
    targetRef.current = 100;
    setProgress(100);
  }, [stopTick]);

  // Reset to 0 and restart ticking
  const reset = useCallback(() => {
    stopTick();
    targetRef.current = 0;
    setProgress(0);
    setStageIndex(0);
    startTick();
  }, [stopTick, startTick]);

  useEffect(() => {
    if (!active) {
      stopTick();
      return;
    }
    startTick();
    return () => stopTick();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return { progress, stageIndex, setTarget, setStageIndex, complete, reset };
}
