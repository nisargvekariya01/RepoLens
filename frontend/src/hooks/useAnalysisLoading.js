import { useState, useEffect, useRef, useCallback } from "react";

/**
 * useAnalysisLoading
 *
 * Manages analysis loading state including:
 *   - Animated stage progression through analysis phases
 *   - Real-time progress tracking (manual or socket-driven)
 *   - Estimated timing display
 *   - Smooth transitions between loading stages
 *
 * @param {Object} options
 * @param {string[]} options.stages - Array of stage label strings to cycle through
 * @param {number}   options.estimatedMs - Total estimated duration in ms (used for auto-progress)
 * @param {boolean}  options.autoProgress - If true, auto-advance progress based on time
 * @param {number}   options.initialProgress - Starting progress value (0-100)
 */
export function useAnalysisLoading({
  stages = DEFAULT_STAGES,
  estimatedMs = 120000,
  autoProgress = false,
  initialProgress = 0,
} = {}) {
  const [progress, setProgress] = useState(initialProgress);
  const [status, setStatus] = useState("idle"); // idle | pending | running | completed | failed
  const [message, setMessage] = useState("");
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const progressIntervalRef = useRef(null);
  const stageIntervalRef = useRef(null);
  const isActiveRef = useRef(true);

  // Advance stage labels at regular intervals
  const startStageAdvancement = useCallback(() => {
    if (stageIntervalRef.current) return;
    const stageInterval = Math.floor(estimatedMs / Math.max(stages.length, 1));
    let idx = 0;

    stageIntervalRef.current = setInterval(() => {
      if (!isActiveRef.current) return;
      idx = Math.min(idx + 1, stages.length - 1);
      setCurrentStageIndex(idx);
    }, stageInterval);
  }, [stages, estimatedMs]);

  // Auto-advance progress smoothly
  const startAutoProgress = useCallback(() => {
    if (!autoProgress || progressIntervalRef.current) return;
    const tickMs = 500;
    const increment = (tickMs / estimatedMs) * 100;

    progressIntervalRef.current = setInterval(() => {
      if (!isActiveRef.current) return;
      setProgress((prev) => {
        const next = prev + increment;
        // Cap at 90% — final 10% reserved for actual completion
        return next >= 90 ? 90 : next;
      });
    }, tickMs);
  }, [autoProgress, estimatedMs]);

  const stopAllTimers = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (stageIntervalRef.current) {
      clearInterval(stageIntervalRef.current);
      stageIntervalRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopAllTimers();
    setProgress(initialProgress);
    setStatus("idle");
    setMessage("");
    setCurrentStageIndex(0);
    setIsLoading(false);
  }, [stopAllTimers, initialProgress]);

  const startLoading = useCallback(() => {
    setIsLoading(true);
    setStatus("running");
    setCurrentStageIndex(0);
    startStageAdvancement();
    startAutoProgress();
  }, [startStageAdvancement, startAutoProgress]);

  const completeLoading = useCallback(() => {
    stopAllTimers();
    setProgress(100);
    setStatus("completed");
    setIsLoading(false);
  }, [stopAllTimers]);

  const failLoading = useCallback((errorMessage = "") => {
    stopAllTimers();
    setStatus("failed");
    setMessage(errorMessage);
    setIsLoading(false);
  }, [stopAllTimers]);

  // Sync progress from external source (e.g. socket updates)
  const syncProgress = useCallback((newProgress, newMessage, newStatus) => {
    if (!isActiveRef.current) return;
    if (newProgress !== undefined && newProgress !== null) {
      setProgress(Math.min(Math.max(newProgress, 0), 100));
    }
    if (newMessage) setMessage(newMessage);
    if (newStatus) setStatus(newStatus);
  }, []);

  useEffect(() => {
    isActiveRef.current = true;
    return () => {
      isActiveRef.current = false;
      stopAllTimers();
    };
  }, [stopAllTimers]);

  return {
    // State
    progress,
    status,
    message,
    currentStageIndex,
    currentStage: stages[currentStageIndex] || stages[0],
    isLoading,
    stages,

    // Actions
    setProgress,
    setStatus,
    setMessage,
    setCurrentStageIndex,
    setIsLoading,
    reset,
    startLoading,
    completeLoading,
    failLoading,
    syncProgress,
  };
}

// ── Default stage presets ──────────────────────────────────────────────────────

export const DEFAULT_STAGES = [
  "Cloning repository...",
  "Parsing source files...",
  "Analyzing architecture...",
  "Generating embeddings...",
  "Running AI analysis...",
  "Building insights...",
  "Preparing dashboard...",
];

export const AI_ANALYSIS_STAGES = [
  "Connecting to AI engine...",
  "Scanning source files...",
  "Detecting patterns...",
  "Analyzing technical debt...",
  "Evaluating risk factors...",
  "Generating recommendations...",
  "Compiling AI insights...",
];

export const CODE_QUALITY_STAGES = [
  "Reading repository structure...",
  "Analyzing commit patterns...",
  "Evaluating code churn...",
  "Detecting complexity hotspots...",
  "Scanning security vulnerabilities...",
  "Measuring tech stack health...",
  "Building quality report...",
];

export const OVERVIEW_STAGES = [
  "Fetching project data...",
  "Loading health metrics...",
  "Calculating trend data...",
  "Aggregating activity...",
  "Building overview...",
];

export const METRICS_STAGES = [
  "Loading repository metrics...",
  "Processing commit data...",
  "Calculating statistics...",
  "Preparing visualizations...",
];

export default useAnalysisLoading;
