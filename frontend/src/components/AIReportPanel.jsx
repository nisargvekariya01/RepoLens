import { useState, useEffect, useRef } from "react";
import { RefreshCw, Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";
import { io } from "socket.io-client";
import { AnimatePresence, motion } from "framer-motion";
import { getAIReport, runAIAnalysis } from "../api/dashboard.api";

import AIIssuesList from "./AIIssuesList";
import AISuggestionsCard from "./AISuggestionsCard";
import AIRiskCard from "./AIRiskCard";
import AIFutureScoreCard from "./AIFutureScoreCard";
import AITechTrendCard from "./AITechTrendCard";
import AnalysisLoader from "./loading/AnalysisLoader";
import { AISkeleton } from "./loading/SkeletonComponents";

// How long before we show "taking longer than expected" warning (5 min)
const TIMEOUT_WARNING_MS = 5 * 60 * 1000;
// Fallback poll interval when socket is unreliable (10s — not hammering)
const POLL_INTERVAL_MS = 10000;
// Maximum polling duration (10 min hard stop)
const MAX_POLL_MS = 10 * 60 * 1000;

// Realistic AI analysis stage labels
const AI_STAGES = [
  "Cloning repository...",
  "Parsing source files...",
  "Analyzing architecture...",
  "Generating embeddings...",
  "Running AI analysis...",
  "Building insights...",
  "Preparing dashboard...",
];

export const AIReportPanel = ({ projectId }) => {
  const [report, setReport] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [jobStatus, setJobStatus] = useState(null); // null | "pending" | "queued" | "running" | "processing" | "completed" | "failed"
  const [jobProgress, setJobProgress] = useState(0);
  const [jobMessage, setJobMessage] = useState("");
  const [activeJobId, setActiveJobId] = useState(null);
  const [error, setError] = useState(null);
  const [timedOut, setTimedOut] = useState(false);

  // Stage cycling for the loader
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const stageIntervalRef = useRef(null);

  // Refs for cleanup
  const socketRef = useRef(null);
  const pollRef = useRef(null);
  const timeoutRef = useRef(null);
  const pollStartRef = useRef(null);
  const isActiveRef = useRef(true);

  // ── Stage advancement ─────────────────────────────────────────────────────
  const startStageAdvancement = () => {
    if (stageIntervalRef.current) return;
    let idx = 0;
    stageIntervalRef.current = setInterval(() => {
      if (!isActiveRef.current) return;
      idx = Math.min(idx + 1, AI_STAGES.length - 1);
      setCurrentStageIndex(idx);
    }, 18000); // ~18s per stage over ~2min total
  };

  const stopStageAdvancement = () => {
    if (stageIntervalRef.current) {
      clearInterval(stageIntervalRef.current);
      stageIntervalRef.current = null;
    }
    setCurrentStageIndex(0);
  };

  // ── Clean up all side effects ─────────────────────────────────────────────
  const cleanupAll = () => {
    if (socketRef.current) {
      socketRef.current.off("ai:completed");
      socketRef.current.off("job:update");
      socketRef.current.off("job:complete");
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    stopStageAdvancement();
  };

  // ── Fetch report and apply real state ─────────────────────────────────────
  const fetchReport = async () => {
    if (!isActiveRef.current) return;
    try {
      const res = await getAIReport(projectId);
      if (!isActiveRef.current) return;

      if (!res) return;

      if (res.ready === true && res.status === "completed") {
        setReport(res.data);
        setJobStatus("completed");
        setError(null);
        cleanupAll();
        return;
      }

      if (res.status === "failed") {
        setJobStatus("failed");
        setError(res.error || "Analysis failed. Please re-run.");
        cleanupAll();
        return;
      }

      if (res.status === "processing" || res.status === "running" || res.status === "queued" || res.status === "pending" || res.status === "active") {
        setJobStatus(res.status);
        if (res.progress !== undefined) setJobProgress(res.progress);
        if (res.message) setJobMessage(res.message);
        return;
      }

      if (res.status === "idle") {
        setJobStatus(null);
        setReport(null);
      }
    } catch (err) {
      console.warn("[AIReportPanel] fetchReport error:", err);
    }
  };

  // ── Connect WebSocket ──────────────────────────────────────────────────────
  const connectSocket = (jobId) => {
    if (socketRef.current) return;

    const socket = io(import.meta.env.VITE_API_BASE_URL || "http://localhost:5000", {
      transports: ["websocket"]
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join-project", projectId);
      if (jobId) socket.emit("join-job", jobId);
    });

    socket.on("ai:completed", async (data) => {
      if (data.projectId !== projectId) return;
      cleanupAll();
      await fetchReport();
    });

    socket.on("job:update", (data) => {
      if (!isActiveRef.current) return;
      const { progress, status, message } = data;
      const realStatus = ["pending", "queued", "running", "processing", "active"].includes(status) ? status : null;
      if (realStatus) {
        setJobStatus(realStatus);
        if (progress !== undefined && progress !== null) setJobProgress(progress);
        if (message) setJobMessage(message);
      } else if (status === "completed") {
        fetchReport();
      } else if (status === "failed") {
        setJobStatus("failed");
        setError(`Analysis failed: ${message || "Unknown error"}`);
        cleanupAll();
      }
    });

    socket.on("job:complete", async () => {
      cleanupAll();
      await fetchReport();
    });
  };

  // ── Start fallback poll ────────────────────────────────────────────────────
  const startFallbackPoll = () => {
    if (pollRef.current) return;
    pollStartRef.current = Date.now();

    pollRef.current = setInterval(async () => {
      if (!isActiveRef.current) return;

      if (Date.now() - pollStartRef.current > MAX_POLL_MS) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setTimedOut(true);
        return;
      }

      await fetchReport();
    }, POLL_INTERVAL_MS);
  };

  // ── Timeout warning ────────────────────────────────────────────────────────
  const startTimeoutWarning = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (isActiveRef.current && jobStatus !== "completed") {
        setTimedOut(true);
      }
    }, TIMEOUT_WARNING_MS);
  };

  // ── Initial hydration ──────────────────────────────────────────────────────
  useEffect(() => {
    isActiveRef.current = true;

    const hydrate = async () => {
      try {
        const res = await getAIReport(projectId);
        if (!isActiveRef.current) return;

        if (!res) {
          setInitialLoading(false);
          return;
        }

        if (res.ready === true && res.status === "completed") {
          setReport(res.data);
          setJobStatus("completed");
        } else if (res.status === "failed") {
          setJobStatus("failed");
          setError(res.error || "Analysis failed. Please re-run.");
        } else if (["processing", "running", "queued", "pending", "active"].includes(res.status)) {
          setJobStatus(res.status);
          if (res.progress !== undefined) setJobProgress(res.progress);
          if (res.message) setJobMessage(res.message);
          startStageAdvancement();
          connectSocket(null);
          startFallbackPoll();
          startTimeoutWarning();
        }
      } catch (err) {
        console.warn("[AIReportPanel] Hydration error:", err);
      } finally {
        if (isActiveRef.current) setInitialLoading(false);
      }
    };

    hydrate();

    return () => {
      isActiveRef.current = false;
      cleanupAll();
    };
  }, [projectId]);

  // ── Start analysis ─────────────────────────────────────────────────────────
  const handleRunAnalysis = async (force = false) => {
    try {
      setError(null);
      setReport(null);
      setJobStatus("pending");
      setJobProgress(0);
      setJobMessage("Submitting analysis job...");
      setTimedOut(false);
      setCurrentStageIndex(0);
      cleanupAll();

      const res = await runAIAnalysis(projectId, force);

      if (res && res.jobId) {
        setActiveJobId(res.jobId);
        setJobStatus(res.status || "queued");
        startStageAdvancement();
        connectSocket(res.jobId);
        startFallbackPoll();
        startTimeoutWarning();
      } else {
        setJobStatus("failed");
        setError("Failed to get a job ID from the server. Please try again.");
      }
    } catch (err) {
      setJobStatus("failed");
      if (err.response?.status === 400) {
        setError(err.response.data.error || "Run a sync first before AI analysis.");
      } else if (err.response?.status === 503) {
        setError("AI queue is temporarily unavailable. Please try again.");
      } else {
        setError("Failed to start analysis. Please try again.");
      }
    }
  };

  // ── Re-subscribe to socket when activeJobId changes ───────────────────────
  useEffect(() => {
    if (!activeJobId || !socketRef.current) return;
    if (socketRef.current.connected) {
      socketRef.current.emit("join-job", activeJobId);
    } else {
      socketRef.current.on("connect", () => {
        socketRef.current?.emit("join-job", activeJobId);
      });
    }
  }, [activeJobId]);

  // ── Initial loading (waiting for DB response) ─────────────────────────────
  if (initialLoading) {
    return (
      <>
        <AnalysisLoader
          variant="ai"
          size="md"
          title="Loading AI Report..."
          subtitle="Checking for existing analysis data."
          showProgressBar={false}
          glowEffect={true}
          animated={true}
        />
        <div className="mt-6 opacity-40 pointer-events-none">
          <AISkeleton />
        </div>
      </>
    );
  }

  // ── In-progress states ─────────────────────────────────────────────────────
  const isInProgress = ["pending", "queued", "running", "processing", "active"].includes(jobStatus);
  if (isInProgress) {
    const isPending = jobStatus === "pending" || jobStatus === "queued";
    return (
      <>
        <AnalysisLoader
          variant="ai"
          size="md"
          title={isPending ? "Analysis Queued..." : "Analyzing Repository..."}
          subtitle={
            isPending
              ? "Your analysis request is in the queue and will start shortly."
              : "AI is scanning your source files. This may take 1–5 minutes."
          }
          progress={jobProgress}
          showProgressBar={!isPending}
          glowEffect={true}
          animated={true}
          stages={AI_STAGES}
          currentStageIndex={currentStageIndex}
          message={jobMessage}
          timedOut={timedOut}
          estimatedTime="~2–5 min"
        />
        <div className="mt-6 opacity-40 pointer-events-none">
          <AISkeleton />
        </div>
      </>
    );
  }

  // ── Failed state ───────────────────────────────────────────────────────────
  if (jobStatus === "failed") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-12 border border-red-500/40 text-center shadow-sm"
      >
        <AlertTriangle size={48} className="mx-auto text-red-400 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">Analysis Failed</h3>
        <p className="text-text-muted mb-6 max-w-md mx-auto text-sm">{error || "An unknown error occurred during analysis."}</p>
        <button
          onClick={() => handleRunAnalysis(true)}
          className="inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary-hover glow-purple transition-all"
        >
          <RefreshCw size={16} className="mr-2" />
          Retry Analysis
        </button>
      </motion.div>
    );
  }

  // ── Empty state — no report, no active job ─────────────────────────────────
  if (!report) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-12 border border-white/20 text-center shadow-sm"
        style={{ borderStyle: "dashed" }}
      >
        <Sparkles size={48} className="mx-auto text-white/30 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No AI report yet</h3>
        <p className="text-text-muted mb-6 max-w-md mx-auto">
          Run a deep AI analysis powered by Groq (Llama 3.1) to scan your actual source files and uncover
          tech debt, risk factors, and actionable suggestions.
        </p>
        {error && <p className="text-neon-pink mb-4 text-sm font-medium">{error}</p>}
        <button
          onClick={() => handleRunAnalysis(false)}
          className="inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary-hover glow-purple transition-all"
        >
          <Sparkles size={16} className="mr-2" />
          Run AI Analysis
        </button>
      </motion.div>
    );
  }

  // ── Report display ─────────────────────────────────────────────────────────
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="report"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="space-y-6"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <CheckCircle2 size={14} className="text-neon-green" />
            Analysis completed on {new Date(report.generated_at).toLocaleString()}
          </div>
          <button
            onClick={() => handleRunAnalysis(true)}
            className="text-xs flex items-center px-3 py-1.5 glass rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors border border-white/10"
          >
            <RefreshCw size={12} className="mr-1" /> Re-run
          </button>
        </div>

        {error && <p className="text-neon-pink text-sm">{error}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          <AIIssuesList issuesData={report.issues_data} />
          <AISuggestionsCard suggestionsData={report.suggestions_data} />
          <AIRiskCard riskData={report.risk_data} />
        </div>

        {/* Full-width sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AIFutureScoreCard
            futureScoreData={report.future_score_data}
            currentScore={report.code_quality_score}
          />
          <AITechTrendCard techTrendData={report.tech_trend_data} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AIReportPanel;
