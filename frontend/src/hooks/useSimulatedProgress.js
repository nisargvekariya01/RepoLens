import { useState, useRef, useCallback, useEffect } from "react";

/**
 * useSimulatedProgress
 *
 * Drives a realistic stage-by-stage progress simulation for REST API loaders.
 * Each stage owns an equal slice of 0–95%; markComplete() snaps to 100%.
 *
 * KEY FIX: reset() increments a `revision` counter so the main useEffect
 * restarts even when `active` stays true (which is the initial-mount case).
 *
 * @param {string[]}  stages           - Stage label array
 * @param {number[]}  stageDurations   - Duration in ms for each stage
 * @param {boolean}   active           - Controls start/stop of simulation
 */
export function useSimulatedProgress({ stages = [], stageDurations = [], active = false }) {
  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress]     = useState(0);

  // Incrementing revision restarts the effect even when `active` stays true
  const [revision, setRevision] = useState(0);

  const tickRef  = useRef(null);
  const isActive = useRef(active);

  useEffect(() => {
    isActive.current = active;
  }, [active]);

  const stopAll = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  /**
   * reset() — restarts simulation from 0.
   * Safe to call even while active=true because revision bump re-triggers the effect.
   */
  const reset = useCallback(() => {
    stopAll();
    setStageIndex(0);
    setProgress(0);
    setRevision(r => r + 1);
  }, [stopAll]);

  /**
   * markComplete() — snap progress to 100% and stop the ticker.
   * Call this immediately after the API call resolves.
   */
  const markComplete = useCallback(() => {
    stopAll();
    setStageIndex(stages.length > 0 ? stages.length - 1 : 0);
    setProgress(100);
  }, [stopAll, stages.length]);

  useEffect(() => {
    if (!active) {
      stopAll();
      return;
    }

    // Reset visual state at the start of each run
    setStageIndex(0);
    setProgress(0);

    const totalStages = stages.length;
    if (totalStages === 0) return;

    // Each stage owns an equal slice of 0–95%
    // (last 5% is reserved for markComplete's 100% snap)
    const slicePerStage = 95 / totalStages;

    let currentStage = 0;
    let stageStart   = Date.now();

    const tick = () => {
      if (!isActive.current) return;

      const duration = stageDurations[currentStage] ?? 4000;
      const elapsed  = Date.now() - stageStart;
      const pct      = Math.min(elapsed / duration, 1);

      // Progress within the current stage's slice
      const stageBase  = currentStage * slicePerStage;
      const stageValue = stageBase + pct * slicePerStage;
      setProgress(Math.round(Math.min(stageValue, 95)));

      // Advance to next stage when this one completes
      if (pct >= 1 && currentStage < totalStages - 1) {
        currentStage++;
        setStageIndex(currentStage);
        stageStart = Date.now();
      }
    };

    // Fire immediately so the bar isn't stuck at 0% on mount
    tick();
    tickRef.current = setInterval(tick, 120);

    return () => stopAll();

  // `revision` is the key dep — it lets reset() restart without toggling active.
  // stageDurations & stages are stable module-level constants in every consumer.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, revision]);

  return { progress, stageIndex, reset, markComplete };
}
