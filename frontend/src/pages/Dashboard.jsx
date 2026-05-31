import { useState, useEffect, useRef } from "react";
import { Plus, X, Search, Activity, Boxes, Settings, Link2, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import ProjectCard from "../components/ProjectCard";
import GitHubConnectButton from "../components/GitHubConnectButton";
import PrivateRepoWarning from "../components/PrivateRepoWarning";
import GithubIcon from "../components/GithubIcon";
import { getProjects, createProject } from "../api/project.api";
import { getHealth } from "../api/dashboard.api";
import { useGitHubConnection } from "../hooks/useGitHubConnection";
import { checkRepoVisibility } from "../api/github.api";

const Dashboard = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [healthData, setHealthData] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Manual URL add modal
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", github_url: "" });
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [repoCheck, setRepoCheck] = useState(null);
  const [checkingRepo, setCheckingRepo] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isEmptyAddMenuOpen, setIsEmptyAddMenuOpen] = useState(false);
  const addMenuRef = useRef(null);
  const emptyAddMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target)) {
        setIsAddMenuOpen(false);
      }
      if (emptyAddMenuRef.current && !emptyAddMenuRef.current.contains(event.target)) {
        setIsEmptyAddMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const github = useGitHubConnection();

  useEffect(() => { fetchProjects(); }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const data = await getProjects();
      setProjects(data);

      const healthResults = await Promise.all(
        data.map(async (p) => {
          try {
            const h = await getHealth(p.id);
            return { id: p.id, data: h.snapshot };
          } catch { return { id: p.id, data: null }; }
        })
      );
      const healthMap = {};
      healthResults.forEach((r) => { healthMap[r.id] = r.data; });
      setHealthData(healthMap);
    } catch (err) {
      console.error("Failed to fetch projects", err);
    } finally {
      setLoading(false);
    }
  };

  // Live repo visibility check (debounced 700ms)
  useEffect(() => {
    if (!newProject.github_url) { setRepoCheck(null); return; }
    const timer = setTimeout(async () => {
      try {
        const url = new URL(newProject.github_url.trim().replace(/\.git$/, ""));
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts.length >= 2) {
          setCheckingRepo(true);
          const result = await checkRepoVisibility(parts[0], parts[1]);
          setRepoCheck(result);
        }
      } catch { setRepoCheck(null); }
      finally { setCheckingRepo(false); }
    }, 700);
    return () => clearTimeout(timer);
  }, [newProject.github_url]);

  const handleManualAdd = async (e) => {
    e.preventDefault();
    setSubmitError("");
    setSubmitting(true);
    try {
      const result = await createProject(newProject);
      setIsManualModalOpen(false);
      setNewProject({ name: "", github_url: "" });
      setRepoCheck(null);
      navigate(`/projects/${result.id}`);
    } catch (err) {
      const errData = err.response?.data;
      setSubmitError(errData?.error || "Failed to create project");
    } finally { setSubmitting(false); }
  };

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      `${p.repo_owner}/${p.repo_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const privateCount = projects.filter((p) => p.visibility === "private").length;
  const isPrivateWithoutAuth = repoCheck?.private && !github.isConnected;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-transparent">

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="section-header">
              <Boxes size={20} style={{ color: "#1E90FF" }} />
              <h1 className="text-2xl font-bold text-white">Analyzed Repositories</h1>
            </div>
            <p className="text-sm ml-1" style={{ color: "#94A3B8" }}>
              {projects.length > 0
                ? `Monitoring ${projects.length} repositor${projects.length === 1 ? "y" : "ies"}${privateCount > 0 ? ` · ${privateCount} private` : ""}`
                : "Import a GitHub repository to get AI-powered insights"}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Search */}
            {projects.length > 0 && (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#475569" }} />
                <input
                  type="text"
                  placeholder="Search repos..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-lg text-sm"
                  style={{
                    background: "rgba(10,15,30,0.8)", border: "1px solid rgba(255,255,255,0.08)",
                    color: "#E6F1FF", width: "180px", outline: "none",
                  }}
                />
              </div>
            )}

            {/* Add Repository Dropdown */}
            <div className="relative" ref={addMenuRef}>
              <button
                onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: "linear-gradient(135deg, rgba(30,144,255,0.15) 0%, rgba(139,92,246,0.15) 100%)",
                  border: "1px solid rgba(30,144,255,0.35)",
                  color: "#3DBBFF",
                  boxShadow: "0 0 20px rgba(30,144,255,0.15)",
                }}
              >
                <Plus size={15} />
                Add Repository
              </button>
              
              <div
                className={`absolute right-0 mt-2 p-3 rounded-xl flex-col gap-2 z-50 min-w-[200px] ${isAddMenuOpen ? "flex" : "hidden"}`}
                style={{
                  background: "rgba(10,15,30,0.95)",
                  backdropFilter: "blur(24px)",
                  border: "1px solid rgba(30,144,255,0.25)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                }}
              >
                <div onClick={() => setIsAddMenuOpen(false)} className="w-full [&>button]:w-full [&>button]:justify-center [&>div]:w-full [&>div>button]:w-full [&>div>button]:justify-center">
                  <GitHubConnectButton github={github} onImportDone={() => fetchProjects()} />
                </div>
                <button
                  onClick={() => { setIsManualModalOpen(true); setIsAddMenuOpen(false); }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all w-full"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#94A3B8",
                  }}
                >
                  <Link2 size={14} />
                  Add by URL
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── GitHub nudge banner (private repos without auth) ── */}
        {!github.loading && !github.isConnected && privateCount > 0 && (
          <div className="mb-6 p-4 rounded-xl flex items-center justify-between gap-4"
            style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}
          >
            <p className="text-sm" style={{ color: "#F59E0B" }}>
              ⚠️ You have {privateCount} private repo{privateCount > 1 ? "s" : ""} — connect GitHub to enable AI analysis.
            </p>
            <Link to="/settings/github"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap"
              style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "#F59E0B" }}
            >
              Connect Now →
            </Link>
          </div>
        )}

        {/* ── Content ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "rgba(30,144,255,0.3)", borderTopColor: "#1E90FF" }} />
            <span className="text-sm shimmer-text">Loading repositories...</span>
          </div>

        ) : filtered.length === 0 && search ? (
          <div className="glass-card p-12 text-center" style={{ border: "1px dashed rgba(255,255,255,0.1)" }}>
            <Search size={32} className="mx-auto mb-3" style={{ color: "#475569" }} />
            <h3 className="text-lg font-semibold text-white mb-1">No results for "{search}"</h3>
            <p style={{ color: "#94A3B8" }}>Try a different search term</p>
          </div>

        ) : projects.length === 0 ? (
          /* ── Empty state — GitHub-first CTA ── */
          <div className="flex flex-col items-center justify-center py-12 gap-6">
            <div
              className="w-full max-w-lg rounded-2xl p-8 text-center"
              style={{
                background: "rgba(10,15,30,0.7)",
                border: "1px solid rgba(30,144,255,0.15)",
                boxShadow: "0 0 60px rgba(30,144,255,0.06)",
              }}
            >
              <div
                className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center"
                style={{ background: "rgba(30,144,255,0.08)", border: "1px solid rgba(30,144,255,0.2)" }}
              >
                <GithubIcon size={36} style={{ color: "#1E90FF" }} />
              </div>

              <h3 className="text-xl font-bold text-white mb-2">Import your first repository</h3>
              <p className="text-sm mb-8 max-w-sm mx-auto" style={{ color: "#94A3B8" }}>
                Connect GitHub to browse and import repositories, or paste a URL to get started.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <div className="relative" ref={emptyAddMenuRef}>
                  <button
                    onClick={() => setIsEmptyAddMenuOpen(!isEmptyAddMenuOpen)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold w-full sm:w-auto"
                    style={{
                      background: "linear-gradient(135deg, rgba(30,144,255,0.15) 0%, rgba(139,92,246,0.15) 100%)",
                      border: "1px solid rgba(30,144,255,0.35)",
                      color: "#3DBBFF",
                      boxShadow: "0 0 20px rgba(30,144,255,0.15)",
                    }}
                  >
                    <Plus size={15} />
                    Add Repository
                  </button>
                  <div
                    className={`absolute top-full left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-0 mt-2 p-3 rounded-xl flex-col gap-2 z-50 min-w-[200px] ${isEmptyAddMenuOpen ? "flex" : "hidden"}`}
                    style={{
                      background: "rgba(10,15,30,0.95)",
                      backdropFilter: "blur(24px)",
                      border: "1px solid rgba(30,144,255,0.25)",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                    }}
                  >
                    <div onClick={() => setIsEmptyAddMenuOpen(false)} className="w-full [&>button]:w-full [&>button]:justify-center [&>div]:w-full [&>div>button]:w-full [&>div>button]:justify-center">
                      <GitHubConnectButton github={github} onImportDone={() => fetchProjects()} />
                    </div>
                    <button
                      onClick={() => { setIsManualModalOpen(true); setIsEmptyAddMenuOpen(false); }}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all w-full"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#94A3B8",
                      }}
                    >
                      <Link2 size={14} />
                      Add by URL
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl w-full">
              {[
                { icon: "🔐", title: "Private Repos", desc: "Full support with encrypted OAuth tokens" },
                { icon: "🤖", title: "AI Analysis",   desc: "RAG-powered code intelligence on every file" },
                { icon: "📊", title: "Health Scores", desc: "Real-time quality metrics & trend tracking" },
              ].map((f) => (
                <div key={f.title}
                  className="p-4 rounded-xl text-center"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <p className="text-2xl mb-2">{f.icon}</p>
                  <p className="text-sm font-semibold text-white mb-1">{f.title}</p>
                  <p className="text-xs" style={{ color: "#94A3B8" }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                latestSnapshot={healthData[project.id]}
                isGitHubConnected={github.isConnected}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Manual URL Add Modal ── */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: "rgba(5,8,22,0.85)", backdropFilter: "blur(8px)" }}
            onClick={() => setIsManualModalOpen(false)} />

          <div className="relative z-10 w-full max-w-md"
            style={{
              background: "rgba(10,15,30,0.95)", backdropFilter: "blur(24px)",
              border: "1px solid rgba(30,144,255,0.25)", borderRadius: "20px",
              boxShadow: "0 32px 80px rgba(0,0,0,0.7)", overflow: "hidden",
            }}
          >
            <div className="h-px w-full" style={{
              background: "linear-gradient(90deg, transparent, rgba(30,144,255,0.8), rgba(255,45,85,0.4), transparent)",
            }} />

            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-bold text-white">Add by GitHub URL</h3>
                  <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                    Paste a public or private repository URL
                  </p>
                </div>
                <button onClick={() => { setIsManualModalOpen(false); setRepoCheck(null); }}
                  className="p-2 rounded-lg" style={{ color: "#94A3B8", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleManualAdd} className="space-y-4">
                {submitError && (
                  <div className="p-3 rounded-xl text-sm"
                    style={{ background: "rgba(255,45,85,0.08)", border: "1px solid rgba(255,45,85,0.25)", color: "#FF2D55" }}>
                    {submitError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#94A3B8" }}>
                    Project Name
                  </label>
                  <input type="text" required className="input-repolens" placeholder="My Project"
                    value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#94A3B8" }}>
                    GitHub Repository URL
                  </label>
                  <div className="relative">
                    <input type="url" required className="input-repolens font-mono text-sm pr-28"
                      placeholder="https://github.com/owner/repo"
                      value={newProject.github_url}
                      onChange={(e) => setNewProject({ ...newProject, github_url: e.target.value })} />
                    {checkingRepo && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                          style={{ borderColor: "rgba(30,144,255,0.3)", borderTopColor: "#1E90FF" }} />
                      </div>
                    )}
                    {!checkingRepo && repoCheck?.private !== null && repoCheck && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={repoCheck.private
                            ? { background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)" }
                            : { background: "rgba(16,185,129,0.1)", color: "#10B981", border: "1px solid rgba(16,185,129,0.25)" }}>
                          {repoCheck.private ? "🔒 Private" : "🌐 Public"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {isPrivateWithoutAuth && (
                  <PrivateRepoWarning repoFullName={repoCheck?.full_name} onConnectClick={() => setIsManualModalOpen(false)} />
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setIsManualModalOpen(false); setRepoCheck(null); }}
                    className="btn-ghost flex-1 py-3 rounded-xl text-sm font-medium">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting || isPrivateWithoutAuth}
                    className="btn-primary flex-1 py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                    {submitting ? "Creating..." : "Connect Repository"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
