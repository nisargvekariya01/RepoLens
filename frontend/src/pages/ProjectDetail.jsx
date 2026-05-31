import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, GitBranch, Clock, CheckCircle2, XCircle, Sparkles, Settings, FolderTree, BarChart3, Activity, FileCode2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import HealthScoreCard from "../components/HealthScoreCard";
import TrendChart from "../components/TrendChart";
import RecommendationCard from "../components/RecommendationCard";
import AlertBadge from "../components/AlertBadge";
import { getProject, queueProjectSync, getProjectSyncJobs, renameProject, deleteProject } from "../api/project.api";
import { getHealth, getSnapshots, getRecommendations, getAlerts } from "../api/dashboard.api";
import { getHealthColor } from "../components/ProjectCard";
import AIReportPanel from "../components/AIReportPanel";
import RepoStructure from "../components/RepoStructure";
import RepoMetricsDashboard from "../components/RepoMetricsDashboard";
import RepoActivityDashboard from "../components/RepoActivityDashboard";
import RepoCodeQualityDashboard from "../components/RepoCodeQualityDashboard";
import ErrorBoundary from "../components/ErrorBoundary";
import SectionExportButton from "../components/SectionExportButton";
import { OverviewSkeleton } from "../components/loading/SkeletonComponents";
import AnalysisLoader from "../components/loading/AnalysisLoader";
import { useJobProgressTracker } from "../hooks/useJobProgressTracker";

const ProjectDetail = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [health, setHealth] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [jobs, setJobs] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [overviewRefreshing, setOverviewRefreshing] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [renameInput, setRenameInput] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Dashboard Preferences
  const [preferences, setPreferences] = useState(() => {
    const saved = localStorage.getItem('dashboard_preferences');
    return saved ? JSON.parse(saved) : {
      metrics: true,
      activity: true,
      codeQuality: true,
      aiAnalysis: true,
    };
  });

  const OVERVIEW_STAGES = [
    "Queueing sync job...",
    "Cloning repository...",
    "Analyzing changes...",
    "Updating health metrics...",
    "Finalizing results...",
  ];

  const {
    progress: overviewProgress,
    stageIndex: overviewStageIndex,
    setTarget: overviewSetTarget,
    setStageIndex: overviewSetStageIndex,
    complete: overviewComplete,
    reset: overviewReset,
  } = useJobProgressTracker(overviewRefreshing);

  const togglePreference = (key) => {
    const nextPrefs = { ...preferences, [key]: !preferences[key] };
    setPreferences(nextPrefs);
    localStorage.setItem('dashboard_preferences', JSON.stringify(nextPrefs));
    if (activeTab === key && !nextPrefs[key]) {
      setActiveTab("overview");
    }
    // Mapping specific tab names
    if (activeTab === "ai_analysis" && key === "aiAnalysis" && !nextPrefs[key]) setActiveTab("overview");
    if (activeTab === "code_quality" && key === "codeQuality" && !nextPrefs[key]) setActiveTab("overview");
  };

  useEffect(() => {
    if (project) {
      setRenameInput(project.name);
    }
  }, [project]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [projData, healthData, snapshotsData, recsData, alertsData, jobsData] = await Promise.all([
        getProject(id),
        getHealth(id).catch(() => null),
        getSnapshots(id).catch(() => []),
        getRecommendations(id).catch(() => []),
        getAlerts(id).catch(() => []),
        getProjectSyncJobs(id).catch(() => [])
      ]);

      setProject(projData);
      setRenameInput(projData.name);
      if (healthData && !healthData.message) {
        setHealth(healthData);
      }
      setSnapshots(snapshotsData);
      
      const uniqueRecs = recsData.filter((rec, index, self) =>
        index === self.findIndex((r) => r.title === rec.title)
      );
      setRecommendations(uniqueRecs);
      setAlerts(alertsData);
      setJobs(jobsData);
    } catch (error) {
      console.error("Failed to fetch project details", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Set up polling for jobs if there's a pending job
    const interval = setInterval(() => {
      getProjectSyncJobs(id).then(data => {
        setJobs(data);
        // If a pending job completed, refresh all data
        if (jobs.length > 0 && jobs[0].status === 'pending' && data.length > 0 && data[0].status !== 'pending') {
          fetchData();
        }
      }).catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, [id]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      overviewReset();
      setOverviewRefreshing(true);
      overviewSetTarget(10); // queued milestone
      overviewSetStageIndex(0);
      await queueProjectSync(id);
      showToast("Sync queued successfully");
      // Instantly refresh jobs list
      const jobsData = await getProjectSyncJobs(id);
      setJobs(jobsData);

      // Poll real job status → drive progress milestones
      const poll = setInterval(async () => {
        try {
          const latestJobs = await getProjectSyncJobs(id);
          setJobs(latestJobs);
          const job = latestJobs[0];

          if (!job) return;

          // Map real job status → progress milestone & stage
          if (job.status === 'pending') {
            overviewSetTarget(30);
            overviewSetStageIndex(1);
          } else if (job.status === 'running' || job.status === 'processing') {
            overviewSetTarget(75);
            overviewSetStageIndex(2);
          } else if (job.status === 'completed' || job.status === 'failed') {
            clearInterval(poll);
            overviewSetStageIndex(4);
            overviewComplete(); // snaps to 100% immediately

            // Refresh overview data after completion
            const [healthData, snapshotsData, recsData] = await Promise.all([
              getHealth(id).catch(() => null),
              getSnapshots(id).catch(() => []),
              getRecommendations(id).catch(() => []),
            ]);
            if (healthData && !healthData.message) setHealth(healthData);
            setSnapshots(snapshotsData);

            const uniqueRecs = recsData.filter((rec, index, self) =>
              index === self.findIndex((r) => r.title === rec.title)
            );
            setRecommendations(uniqueRecs);
            setTimeout(() => setOverviewRefreshing(false), 600);
          }
        } catch (e) {
          clearInterval(poll);
          setOverviewRefreshing(false);
        }
      }, 4000);

      // Safety timeout — stop after 3 min max
      setTimeout(() => {
        clearInterval(poll);
        setOverviewRefreshing(false);
      }, 3 * 60 * 1000);
    } catch (error) {
      showToast("Failed to queue sync", "error");
      setOverviewRefreshing(false);
    } finally {
      setSyncing(false);
    }
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const removeAlert = (alertId) => {
    setAlerts(alerts.filter(a => a.id !== alertId));
  };

  const navigate = useNavigate();

  const handleRename = async (e) => {
    e.preventDefault();
    if (renameInput.trim().length < 2) {
      showToast("Name must be at least 2 characters", "error");
      return;
    }
    
    setIsRenaming(true);
    try {
      const updated = await renameProject(id, { name: renameInput });
      setProject(updated);
      showToast("Project renamed successfully!");
    } catch (error) {
      showToast(error.response?.data?.error || "Failed to rename project", "error");
      setRenameInput(project.name); // Revert on fail
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteProject(id);
      showToast("Project deleted successfully");
      navigate("/dashboard");
    } catch (error) {
      showToast(error.response?.data?.error || "Failed to delete project", "error");
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  const getJobStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="text-green-500" size={16} />;
      case 'failed': return <XCircle className="text-red-500" size={16} />;
      default: return <RefreshCw className="text-blue-500 animate-spin" size={16} />;
    }
  };

  const getRelativeTime = (dateStr) => {
    if (!dateStr) return "Never";
    const diff = Math.floor((new Date() - new Date(dateStr)) / 60000); // minutes
    if (diff < 1) return "Just now";
    if (diff < 60) return `${diff} min ago`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours} hr ago`;
    return `${Math.floor(hours / 24)} days ago`;
  };

  if (loading && !project) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col relative overflow-hidden">
        <div className="flex-1 flex justify-center items-center relative z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col relative overflow-hidden">
        <div className="flex-1 flex justify-center items-center relative z-10">
          <p className="text-text-muted">Project not found.</p>
        </div>
      </div>
    );
  }

  const score = health?.score;
  const label = health?.label || "Unsynced";

  return (
    <div className="min-h-screen bg-transparent flex flex-col relative overflow-hidden">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-20 right-4 p-4 rounded-lg shadow-lg z-50 transition-all border ${toast.type === 'error' ? 'bg-neon-pink/80 backdrop-blur-md border-neon-pink text-white glow-pink' : 'glass border-white/20 text-white glow-blue'}`}>
          {toast.message}
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <div className="mb-6">
          <Link to="/dashboard" className="inline-flex items-center text-sm font-medium text-text-muted hover:text-white mb-4 transition-colors">
            <ArrowLeft size={16} className="mr-1" /> Back to Dashboard
          </Link>
          
          <div className="flex flex-col xl:flex-row xl:justify-between xl:items-start gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center text-glow flex-wrap gap-2">
                {project.name}
              </h1>
              <a 
                href={project.github_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="mt-2 flex items-center text-text-muted hover:text-primary transition-colors w-fit break-all text-sm sm:text-base"
              >
                <GitBranch size={16} className="mr-1.5 shrink-0" />
                {project.repo_owner}/{project.repo_name}
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-6 mt-4 xl:mt-0">
              {score !== undefined && (
                <div className="flex items-center bg-[#0B1121] px-5 py-3 rounded-xl border border-white/10">
                  <div className="mr-5 flex flex-col items-center">
                    <div className="text-sm text-white/90 font-bold mb-1.5">Health Score</div>
                    <div 
                      className="text-xs font-bold px-3 py-0.5 rounded-full inline-block"
                      style={{
                        background: getHealthColor(score).bg,
                        color: getHealthColor(score).text,
                        border: `1px solid ${getHealthColor(score).border}`,
                        boxShadow: getHealthColor(score).glow !== 'none' ? getHealthColor(score).glow : undefined
                      }}
                    >
                      {label}
                    </div>
                  </div>
                  <div className="text-[42px] leading-none font-black text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.3)] tracking-tight">{score}</div>
                </div>
              )}
              
              <div className="flex flex-col text-right mr-4 items-end">
                 <p className="text-[10px] text-text-muted uppercase tracking-widest font-semibold mb-1">Last Updated</p>
                 <div className="flex items-center text-sm font-medium text-white/90">
                    <Clock size={12} className="mr-1.5 text-neon-purple" /> 
                    {getRelativeTime(project.last_updated_at || project.updated_at)}
                 </div>
              </div>

            </div>
          </div>
        </div>

        {/* Custom Tab Pattern consistent with dashboard sub-navigations */}
        <div className="flex flex-nowrap md:flex-wrap border-b border-white/10 mb-8 space-x-2 sm:space-x-4 md:space-x-6 overflow-x-auto pb-2 scrollbar-hide w-full">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap flex-shrink-0 ${
              activeTab === "overview" ? "border-primary text-white text-glow" : "border-transparent text-text-muted hover:text-white/80"
            }`}
          >
            Overview
          </button>
          
          {preferences.aiAnalysis && (
            <button
              onClick={() => setActiveTab("ai_analysis")}
              className={`flex items-center pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap flex-shrink-0 ${
                activeTab === "ai_analysis" ? "border-neon-purple text-white text-glow-purple" : "border-transparent text-text-muted hover:text-white/80"
              }`}
            >
              <Sparkles size={14} className="mr-1.5" /> AI Analysis
            </button>
          )}

          <button
            onClick={() => setActiveTab("repo_tree")}
            className={`flex items-center pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap flex-shrink-0 ${
              activeTab === "repo_tree" ? "border-yellow-400 text-white text-glow-yellow" : "border-transparent text-text-muted hover:text-white/80"
            }`}
          >
            <FolderTree size={14} className="mr-1.5" /> Repository Tree
          </button>
          
          {preferences.metrics && (
            <button
              onClick={() => setActiveTab("metrics")}
              className={`flex items-center pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap flex-shrink-0 ${
                activeTab === "metrics" ? "border-neon-green text-white text-glow-green" : "border-transparent text-text-muted hover:text-white/80"
              }`}
            >
              <BarChart3 size={14} className="mr-1.5" /> Metrics
            </button>
          )}

          {preferences.activity && (
            <button
              onClick={() => setActiveTab("activity")}
              className={`flex items-center pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap flex-shrink-0 ${
                activeTab === "activity" ? "border-neon-pink text-white text-glow-pink" : "border-transparent text-text-muted hover:text-white/80"
              }`}
            >
              <Activity size={14} className="mr-1.5" /> Activity
            </button>
          )}

          {preferences.codeQuality && (
            <button
              onClick={() => setActiveTab("code_quality")}
              className={`flex items-center pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap flex-shrink-0 ${
                activeTab === "code_quality" ? "border-neon-cyan text-white text-glow-cyan" : "border-transparent text-text-muted hover:text-white/80"
              }`}
            >
              <FileCode2 size={14} className="mr-1.5" /> Code Quality
            </button>
          )}



          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap flex-shrink-0 ${
              activeTab === "settings" ? "border-white text-white text-glow-white" : "border-transparent text-text-muted hover:text-white/80"
            }`}
          >
            <Settings size={14} className="mr-1.5" /> Settings
          </button>
        </div>

        <ErrorBoundary>
          {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Section header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/8">
              <h2 className="text-lg font-semibold text-white text-glow">Overview</h2>
              <SectionExportButton projectId={id} project={project} projectName={project.repo_name || project.name} section="overview" overviewData={{ health, snapshots, recommendations, alerts, jobs }} />
            </div>

            {overviewRefreshing ? (
              /* ── Full-width loader: hides ALL content while refreshing ── */
              <motion.div
                key="overview-refreshing"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
              >
                <AnalysisLoader
                  variant="overview"
                  size="lg"
                  title="Refreshing Analysis..."
                  subtitle="Syncing your repository and recalculating health scores, trends, and recommendations."
                  progress={overviewProgress}
                  currentStageIndex={overviewStageIndex}
                  showProgressBar={true}
                  glowEffect={true}
                  animated={true}
                  stages={OVERVIEW_STAGES}
                  estimatedTime="~30 sec – 2 min"
                />
                <div className="mt-6 opacity-40 pointer-events-none">
                  <OverviewSkeleton />
                </div>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Content Area */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Alerts Section */}
                {alerts.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3 text-white flex items-center text-glow">
                      Active Alerts <span className="ml-2 bg-neon-pink/20 text-neon-pink border border-neon-pink/30 py-0.5 px-2 rounded-full text-xs font-bold glow-pink">{alerts.length}</span>
                    </h3>
                    <div className="space-y-2">
                      {alerts.map(alert => (
                        <AlertBadge key={alert.id} alert={alert} projectId={id} onRead={removeAlert} />
                      ))}
                    </div>
                  </div>
                )}

                {loading && !health ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="opacity-60 pointer-events-none"
                  >
                    <OverviewSkeleton />
                  </motion.div>
                ) : !health ? (
                  <div className="glass-card p-12 border-dashed border-white/20 text-center shadow-sm">
                    <RefreshCw size={48} className="mx-auto text-white/30 mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No sync data available</h3>
                    <p className="text-text-muted mb-6">Run your first synchronization to generate health scores and insights.</p>
                    <button
                      onClick={handleSync}
                      className="inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary-hover glow-purple transition-all"
                    >
                      <RefreshCw size={16} className="mr-2" />
                      Run Initial Sync
                    </button>
                  </div>
                ) : (
                  <>
                    <TrendChart data={snapshots} />

                    {recommendations.length > 0 && (
                      <div className="mt-8">
                        <h3 className="text-lg font-semibold mb-4 text-white text-glow">Actionable Recommendations</h3>
                        <div className="space-y-3">
                          {recommendations.map((rec) => (
                            <RecommendationCard key={rec.id} recommendation={rec} />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Sidebar Area */}
              <div className="space-y-6">
                {health && <HealthScoreCard breakdown={health.breakdown} />}

                {/* Sync Jobs Summary */}
                <div className="glass-card p-6">
                   <h3 className="text-lg font-semibold mb-4 text-white text-glow flex items-center">
                     <Clock size={18} className="mr-2 text-white/50" />
                     Recent Job History
                   </h3>
                   {jobs.length === 0 ? (
                     <p className="text-sm text-text-muted text-center py-4">No jobs run yet.</p>
                   ) : (
                     <ul className="space-y-3">
                       {jobs.slice(0, 5).map(job => (
                         <li key={job.id} className="flex justify-between items-center text-sm border-b border-white/5 last:border-0 pb-2 last:pb-0">
                           <div className="flex items-center">
                             {getJobStatusIcon(job.status)}
                             <span className="ml-2 text-white/80 capitalize font-medium">{job.status}</span>
                           </div>
                           <div className="text-white/50 text-xs text-right">
                             {new Date(job.created_at).toLocaleString(undefined, { 
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                             })}
                           </div>
                         </li>
                       ))}
                     </ul>
                   )}
                </div>
              </div>
            </div>
            )}
          </div>
          )}

          {activeTab === "ai_analysis" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-white/8">
                <h2 className="text-lg font-semibold text-white text-glow flex items-center gap-2">
                  <Sparkles size={18} className="text-neon-purple" /> AI Analysis
                </h2>
                <SectionExportButton projectId={id} project={project} projectName={project.repo_name || project.name} section="ai_analysis" />
              </div>
              <AIReportPanel projectId={id} />
            </div>
          )}

          {activeTab === "repo_tree" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/8">
                <h2 className="text-lg font-semibold text-white text-glow flex items-center gap-2">
                  <FolderTree size={18} className="text-neon-purple" /> Repository Tree
                </h2>
                <SectionExportButton projectId={id} project={project} projectName={project.repo_name || project.name} section="repo_tree" />
              </div>
              <div className="w-full">
                <RepoStructure projectId={id} />
              </div>
            </div>
          )}

          {activeTab === "metrics" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-white/8">
                <h2 className="text-lg font-semibold text-white text-glow flex items-center gap-2">
                  <BarChart3 size={18} className="text-neon-purple" /> Metrics
                </h2>
                <SectionExportButton projectId={id} project={project} projectName={project.repo_name || project.name} section="metrics" />
              </div>
              <RepoMetricsDashboard projectId={id} />
            </div>
          )}

          {activeTab === "activity" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-white/8">
                <h2 className="text-lg font-semibold text-white text-glow flex items-center gap-2">
                  <Activity size={18} className="text-neon-purple" /> Activity
                </h2>
                <SectionExportButton projectId={id} project={project} projectName={project.repo_name || project.name} section="activity" />
              </div>
              <RepoActivityDashboard projectId={id} />
            </div>
          )}

          {activeTab === "code_quality" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-white/8">
                <h2 className="text-lg font-semibold text-white text-glow flex items-center gap-2">
                  <FileCode2 size={18} className="text-neon-purple" /> Code Quality
                </h2>
                <SectionExportButton projectId={id} project={project} projectName={project.repo_name || project.name} section="code_quality" />
              </div>
              <RepoCodeQualityDashboard projectId={id} />
            </div>
          )}



          {activeTab === "settings" && (
            <div className="max-w-3xl space-y-8">
              <div 
                className="relative overflow-hidden rounded-2xl p-8"
                style={{
                  background: "rgba(10,15,30,0.65)",
                  backdropFilter: "blur(16px)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
                }}
              >
                {/* Top accent line */}
                <div
                  className="absolute top-0 left-0 right-0 h-px w-full"
                  style={{
                    background: "linear-gradient(90deg, transparent, rgba(30,144,255,0.5), transparent)",
                  }}
                />
                
                {/* Subtle corner glow */}
                <div
                  className="absolute top-0 right-0 w-32 h-32 pointer-events-none"
                  style={{
                    background: "radial-gradient(circle at top right, rgba(30,144,255,0.08), transparent 70%)",
                  }}
                />

                <div className="relative z-10">
                  <h2 className="text-xl font-bold text-white mb-6">Project Settings</h2>
                  
                  {/* Rename Section */}
                  <div className="mb-8">
                    <h3 className="text-sm font-medium text-white mb-3">Rename Project</h3>
                    <form onSubmit={handleRename} className="flex gap-4">
                      <input
                        type="text"
                        value={renameInput}
                        onChange={(e) => setRenameInput(e.target.value)}
                        className="flex-1 rounded-lg px-4 py-2.5 bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all sm:text-sm"
                        placeholder="Project Name"
                      />
                      <button
                        type="submit"
                        disabled={isRenaming}
                        className="inline-flex items-center px-6 py-2.5 shadow-sm text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-500 transition-all disabled:opacity-50"
                      >
                        {isRenaming ? "Saving..." : "Save"}
                      </button>
                    </form>
                  </div>

                  {/* Dashboard Customization */}
                  <div className="mb-8">
                    <h3 className="text-sm font-medium text-white mb-4">Customize Dashboard</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { key: 'metrics', label: 'Metrics Dashboard' },
                        { key: 'activity', label: 'Activity Dashboard' },
                        { key: 'codeQuality', label: 'Code Quality' },
                        { key: 'aiAnalysis', label: 'AI Analysis' }
                      ].map(pref => (
                        <div key={pref.key} className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-colors">
                          <span className="text-sm font-medium text-white/90">{pref.label}</span>
                          <button 
                            onClick={() => togglePreference(pref.key)}
                            className={`w-11 h-6 rounded-full relative transition-colors duration-300 ${preferences[pref.key] ? 'bg-blue-500' : 'bg-white/20'}`}
                          >
                            <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${preferences[pref.key] ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <hr className="border-white/10 mb-8" />

                  {/* Manual Sync Section */}
                  <div className="mb-8">
                    <h3 className="text-sm font-medium text-white mb-3">Manual Synchronization</h3>
                    <div className="border border-white/10 bg-white/5 rounded-xl p-6 transition-colors hover:border-white/20">
                      <h4 className="text-white font-medium mb-1">Refresh Project Analysis</h4>
                      <p className="text-sm text-slate-400 mb-4">
                        Manually trigger a sync with your GitHub repository to update health scores, fetch latest commits, and generate new AI insights.
                      </p>
                      <button
                        onClick={handleSync}
                        disabled={syncing || (jobs.length > 0 && jobs[0].status === 'pending')}
                        className="inline-flex items-center px-5 py-2.5 text-sm font-medium rounded-lg text-white bg-white/10 border border-white/10 hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RefreshCw size={16} className={`mr-2 ${syncing || (jobs.length > 0 && jobs[0].status === 'pending') ? 'animate-spin' : ''}`} />
                        {syncing || (jobs.length > 0 && jobs[0].status === 'pending') ? 'Refreshing...' : 'Refresh Analysis'}
                      </button>
                    </div>
                  </div>

                  <hr className="border-white/10 mb-8" />

                  {/* Danger Zone */}
                  <div>
                    <h3 className="text-sm font-medium text-rose-500 mb-3">Danger Zone</h3>
                    <div className="border border-rose-500/20 bg-rose-500/5 rounded-xl p-6 transition-colors hover:border-rose-500/30">
                      <h4 className="text-white font-medium mb-1">Delete this project</h4>
                      <p className="text-sm text-slate-400 mb-4">
                        Once you delete a project, there is no going back. Please be certain.
                      </p>
                      <button
                        onClick={() => setIsDeleteModalOpen(true)}
                        className="inline-flex items-center px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 text-rose-500 text-sm font-medium rounded-lg transition-all"
                      >
                        Delete Project
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </ErrorBoundary>

      </main>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setIsDeleteModalOpen(false)}>
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm"></div>
            </div>
            
            <div className="inline-block align-bottom glass-card text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full border border-white/10 glow-purple">
              <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-white/10">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg leading-6 font-semibold text-white text-glow">Delete Project?</h3>
                  <button onClick={() => setIsDeleteModalOpen(false)} className="text-text-muted hover:text-white">
                    <XCircle size={20} />
                  </button>
                </div>
              </div>
              
              <div className="px-4 py-5 sm:p-6">
                <p className="text-sm text-text-muted">
                  This action cannot be undone. This will permanently delete the project <span className="font-semibold text-white">"{project.name}"</span> and all associated data, including snapshots, alerts, and AI analysis reports.
                </p>
              </div>

              <div className="bg-surface/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-white/10">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-neon-pink text-base font-medium text-white hover:bg-neon-pink/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neon-pink sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 glow-pink"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-white/20 shadow-sm px-4 py-2 bg-surface text-base font-medium text-white hover:bg-surface/80 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

  );
};

export default ProjectDetail;
