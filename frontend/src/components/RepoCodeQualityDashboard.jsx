import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getProjectCodeQuality } from "../api/project.api";
import ErrorBoundary from "./ErrorBoundary";
import {
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  FileCode,
  FileText,
  Flame
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import AnalysisLoader from "./loading/AnalysisLoader";
import { CodeQualitySkeleton } from "./loading/SkeletonComponents";
import { useSimulatedProgress } from "../hooks/useSimulatedProgress";

const CODE_QUALITY_STAGES = [
  "Cloning repository...",
  "Scanning file structure...",
  "Analyzing commit patterns...",
  "Evaluating code churn...",
  "Detecting complexity hotspots...",
  "Scanning security issues...",
  "Aggregating results...",
];

const CODE_QUALITY_DURATIONS = [4000, 3000, 5000, 5000, 6000, 5000, 4000];

// Module-level cache to deduplicate ongoing requests (fixes React 18 strict mode double-fetching)
const ongoingFetches = new Map();

export default function RepoCodeQualityDashboard({ projectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { progress, stageIndex, reset, markComplete } = useSimulatedProgress({
    stages: CODE_QUALITY_STAGES,
    stageDurations: CODE_QUALITY_DURATIONS,
    active: loading,
  });

  useEffect(() => {
    if (!projectId) return;

    let isMounted = true;
    const fetchData = async () => {
      try {
        reset();
        setLoading(true);
        setError(null);

        let fetchPromise = ongoingFetches.get(projectId);
        if (!fetchPromise) {
          fetchPromise = getProjectCodeQuality(projectId);
          ongoingFetches.set(projectId, fetchPromise);
          fetchPromise.finally(() => {
            if (ongoingFetches.get(projectId) === fetchPromise) {
              ongoingFetches.delete(projectId);
            }
          });
        }

        const res = await fetchPromise;

        if (isMounted) {
          markComplete();
          // Small delay so 100% is visible before content appears
          setTimeout(() => { if (isMounted) setData(res); }, 400);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err.response?.data?.error || "Failed to load code quality data."
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  if (loading) {
    return (
      <>
        <AnalysisLoader
          variant="quality"
          size="md"
          title="Analyzing Code Quality..."
          subtitle="Scanning commits, complexity, security, and tech stack."
          progress={progress}
          currentStageIndex={stageIndex}
          showProgressBar={true}
          glowEffect={true}
          animated={true}
          stages={CODE_QUALITY_STAGES}
          estimatedTime="~30 sec"
        />
        <div className="mt-6 opacity-40 pointer-events-none">
          <CodeQualitySkeleton />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-rose-500/10 text-rose-400 border border-rose-500/20 p-4 rounded-xl flex items-center space-x-2"
      >
        <AlertTriangle className="h-5 w-5" />
        <span>{error}</span>
      </motion.div>
    );
  }

  if (!data) return null;

  const { repoName, churn, commitPatterns, techStack, complexity, security } = data;

  return (
    <AnimatePresence mode="wait">
    <motion.div
      key="cq-content"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="border-b border-white/8 pb-4">
          <h2 className="text-2xl font-bold text-white flex items-center text-glow">
            <FileCode className="h-7 w-7 mr-2 text-neon-blue" />
            Code Quality & Architecture
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Deep analysis of repository code health, stability, and security.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SECTION 5: Security & Best Practices */}
          <div className="glass-card p-6 flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <ShieldAlert className="h-5 w-5 text-neon-pink mr-2" />
              Security & Best Practices
            </h3>

            <div className="space-y-4 flex-1">
              {/* Warnings Badge Box */}
              {security.secretsFound || security.issues.length > 0 ? (
                <div className="p-4 bg-neon-pink/10 rounded-lg border border-neon-pink/20 glow-pink">
                  <div className="flex items-center text-neon-pink font-bold mb-3 uppercase tracking-wider text-xs">
                    <AlertTriangle className="h-4 w-4 mr-1.5" /> Critical Risks Detected
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {security.issues.map((iss, i) => (
                      <span key={i} className="inline-flex items-center px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-neon-pink/10 text-neon-pink border border-neon-pink/30">
                        {iss}
                      </span>
                    ))}
                    {security.secretsFound && security.issues.length === 0 && (
                      <span className="inline-flex items-center px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-neon-pink/10 text-neon-pink border border-neon-pink/30">
                        <Flame className="h-3 w-3 mr-1.5" />
                        Hardcoded secrets detected
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-neon-green/10 rounded-lg border border-neon-green/20 flex items-center text-neon-green font-bold text-sm uppercase tracking-wider glow-green">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  No Critical Security Issues
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-white/5 rounded-lg text-center border border-white/10 flex flex-col items-center justify-center">
                  <span className="block text-xs font-bold text-text-muted uppercase tracking-wider">
                    License
                  </span>
                  <span
                    className={`mt-2 inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${security.hasLicense
                      ? "bg-neon-green/10 text-neon-green border-neon-green/30"
                      : "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
                      }`}
                  >
                    {security.hasLicense ? "Present" : "Missing"}
                  </span>
                </div>
                <div className="p-4 bg-white/5 rounded-lg text-center border border-white/10 flex flex-col items-center justify-center w-full">
                  <span className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                    Readme Score
                  </span>
                  {security.hasReadme ? (
                    <div className="w-full text-left">
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-sm font-black text-white">{security.readmeQualityScore}/100</span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-1000 ${security.readmeQualityScore >= 80
                            ? "bg-neon-green glow-green"
                            : security.readmeQualityScore >= 50
                              ? "bg-yellow-500"
                              : "bg-neon-pink glow-pink"
                            }`}
                          style={{ width: `${security.readmeQualityScore}%` }}
                        ></div>
                      </div>
                    </div>
                  ) : (
                    <span className="mt-1 inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-neon-pink/10 text-neon-pink border border-neon-pink/30">
                      Missing
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: Tech Stack */}
          <div className="glass-card p-6 flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <FileText className="h-5 w-5 text-neon-blue mr-2" />
              Technology Stack
            </h3>

            <div className="space-y-4">
              {techStack.languages?.length > 0 ? (
                <div>
                  <div className="h-40 w-full relative mb-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={techStack.languages}
                          dataKey="percentage"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={2}
                          stroke="none"
                        >
                          {techStack.languages.map((entry, index) => {
                            const colors = ["#1E90FF", "#8B5CF6", "#FF2D55", "#10B981", "#EAB308", "#06B6D4"];
                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                          })}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: 'rgba(10,15,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)' }}
                          itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                          labelStyle={{ color: '#9CA3AF', fontSize: '11px' }}
                          formatter={(value) => `${value}%`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-center pt-2">
                    {techStack.languages.map((lang, idx) => {
                      const colors = ["bg-[#1E90FF]", "bg-[#8B5CF6]", "bg-[#FF2D55]", "bg-[#10B981]", "bg-[#EAB308]", "bg-[#06B6D4]"];
                      return (
                        <div key={lang.name} className="flex items-center text-[10px] font-bold text-white/90 uppercase tracking-wider">
                          <span className={`w-2 h-2 rounded-full mr-1.5 ${colors[idx % colors.length]}`}></span>
                          {lang.name} <span className="text-text-muted font-mono ml-1.5 text-[11px]">{lang.percentage}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <span className="text-sm text-text-muted italic p-4 block bg-white/5 rounded-lg border border-white/10">
                  Unrecognized stack constraints.
                </span>
              )}

              <div className="pt-2 border-t border-white/8 mt-4">
                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
                  Dependency Health
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <span className="block text-xl font-bold text-white">
                      {techStack.dependencies?.total || 0}
                    </span>
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Total</span>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <span
                      className={`block text-xl font-bold ${techStack.dependencies?.outdated > 0
                        ? "text-yellow-500"
                        : "text-white"
                        }`}
                    >
                      {techStack.dependencies?.outdated || 0}
                    </span>
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Outdated</span>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <span
                      className={`block text-xl font-bold ${techStack.dependencies?.risky > 0
                        ? "text-neon-pink"
                        : "text-white"
                        }`}
                    >
                      {techStack.dependencies?.risky || 0}
                    </span>
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Risky</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 1: Code Churn */}
          <div className="glass-card p-6 flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Flame className="h-5 w-5 text-yellow-500 mr-2" />
              High Churn Files
            </h3>

            {churn?.hotFiles && churn.hotFiles.length > 0 ? (
              <div className="overflow-hidden border border-white/8 rounded-lg flex-1">
                <table className="min-w-full divide-y divide-white/8">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-text-muted uppercase tracking-wider">File</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-text-muted uppercase tracking-wider">Instability</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {churn.hotFiles.slice(0, 5).map((f, i) => {
                      const isRisky = f.churnScore > 75;
                      return (
                        <tr key={i} className={`hover:bg-white/5 transition-colors ${isRisky ? 'bg-neon-pink/5 border-l-2 border-l-neon-pink' : 'border-l-2 border-l-transparent'}`}>
                          <td className="px-4 py-3 min-w-0" title={`${repoName || 'repo'}/${f.file}`}>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
                                <span className="text-[10px] font-bold text-neon-cyan bg-neon-cyan/10 border border-neon-cyan/20 px-1.5 py-0.5 rounded shrink-0 leading-tight">
                                  {repoName || "repo"}
                                </span>
                                {f.file.includes("/") && (
                                  <span className="text-[10px] text-text-dim truncate">
                                    {f.file.split("/").slice(0, -1).join("/")}
                                  </span>
                                )}
                              </div>
                              <span className={`text-sm font-semibold truncate ${isRisky ? "text-neon-pink" : "text-white/90"}`}>
                                {f.file.split("/").pop()}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end">
                              <div className="w-16 bg-white/5 rounded-full h-1 mr-3 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-1000 ${isRisky ? 'bg-neon-pink glow-pink' : f.churnScore > 40 ? 'bg-yellow-500' : 'bg-neon-blue'}`}
                                  style={{ width: `${f.churnScore}%` }}
                                ></div>
                              </div>
                              <span className={`text-xs font-bold tabular-nums ${isRisky ? 'text-neon-pink' : 'text-text-muted'}`}>{f.churnScore}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-text-muted italic p-4 bg-white/5 border border-white/8 rounded-lg">
                No significant churn detected.
              </p>
            )}
          </div>

          {/* SECTION 4: Complexity */}
          <div className="glass-card p-6 flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <FileCode className="h-5 w-5 text-neon-purple mr-2" />
              Highest Complexity
            </h3>

            {complexity?.complexFiles && complexity.complexFiles.length > 0 ? (
              (() => {
                const maxComplexity = Math.max(...complexity.complexFiles.map(f => f.complexityScore), 1);
                const scaleFactor = 100 / maxComplexity;

                return (
                  <div className="overflow-hidden border border-white/8 rounded-lg flex-1">
                    <table className="min-w-full divide-y divide-white/8">
                      <thead className="bg-white/5">
                        <tr>
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-text-muted uppercase tracking-wider">File</th>
                          <th className="px-4 py-3 text-right text-[10px] font-bold text-text-muted uppercase tracking-wider">Complexity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {complexity.complexFiles.slice(0, 5).map((f, i) => {
                          const normalizedScore = Math.round(f.complexityScore * scaleFactor);
                          const isRisky = normalizedScore > 60;
                          return (
                            <tr key={i} className={`hover:bg-white/5 transition-colors ${isRisky ? 'bg-neon-pink/5 border-l-2 border-l-neon-pink' : 'border-l-2 border-l-transparent'}`}>
                              <td className="px-4 py-3 min-w-0" title={`${repoName || 'repo'}/${f.file}`}>
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
                                    <span className="text-[10px] font-bold text-neon-purple bg-neon-purple/10 border border-neon-purple/20 px-1.5 py-0.5 rounded shrink-0 leading-tight">
                                      {repoName || "repo"}
                                    </span>
                                    {f.file.includes("/") && (
                                      <span className="text-[10px] text-text-dim truncate">
                                        {f.file.split("/").slice(0, -1).join("/")}
                                      </span>
                                    )}
                                  </div>
                                  <span className={`text-sm font-semibold truncate ${isRisky ? "text-neon-pink" : "text-white/90"}`}>
                                    {f.file.split("/").pop()}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end">
                                  <div className="w-16 bg-white/5 rounded-full h-1 mr-3 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-1000 ${isRisky ? 'bg-neon-pink glow-pink' : 'bg-neon-purple glow-purple'}`}
                                      style={{ width: `${normalizedScore}%` }}
                                    ></div>
                                  </div>
                                  <span className={`text-xs font-bold tabular-nums ${isRisky ? 'text-neon-pink' : 'text-text-muted'}`}>{normalizedScore}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()
            ) : (
              <p className="text-sm text-text-muted italic p-4 bg-white/5 border border-white/8 rounded-lg">
                No highly complex files found.
              </p>
            )}
          </div>

          {/* SECTION 2: Commit Patterns */}
          <div className="glass-card p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
              <FileText className="h-5 w-5 text-neon-green mr-2" />
              Commit Hygiene & Patterns
            </h3>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="flex-1 space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                      Conventional Commits Usage
                    </span>
                    <span className="text-sm font-black text-white">
                      {commitPatterns?.conventionalCommitsUsage || 0}%
                    </span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-neon-green h-full rounded-full glow-green transition-all duration-1000"
                      style={{ width: `${commitPatterns?.conventionalCommitsUsage || 0}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                      Message Quality Score
                    </span>
                    <span className="text-sm font-black text-white">
                      {commitPatterns?.messageQualityScore || 0}/100
                    </span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${commitPatterns?.messageQualityScore > 70
                        ? "bg-neon-green glow-green"
                        : "bg-yellow-500"
                        }`}
                      style={{ width: `${commitPatterns?.messageQualityScore || 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="flex-1 bg-white/5 p-5 rounded-xl border border-white/8">
                <h4 className="text-[10px] font-black text-text-muted mb-4 text-center uppercase tracking-[0.2em]">
                  Type Distribution
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div>
                    <span className="block text-2xl font-black text-neon-green text-glow">
                      {commitPatterns?.commitTypes?.feat || 0}
                    </span>
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Feat</span>
                  </div>
                  <div>
                    <span className="block text-2xl font-black text-neon-blue text-glow">
                      {commitPatterns?.commitTypes?.fix || 0}
                    </span>
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Fix</span>
                  </div>
                  <div>
                    <span className="block text-2xl font-black text-neon-purple text-glow">
                      {commitPatterns?.commitTypes?.refactor || 0}
                    </span>
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Refac</span>
                  </div>
                  <div>
                    <span className="block text-2xl font-black text-text-muted">
                      {commitPatterns?.commitTypes?.chore || 0}
                    </span>
                    <span className="text-[10px] font-bold text-text-muted/50 uppercase tracking-widest">Chore</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </ErrorBoundary>
    </motion.div>
    </AnimatePresence>

  );
}
