import { Link } from "react-router-dom";
import { Activity, GitBranch, Calendar, AlertCircle, ArrowRight, Cpu, Lock, Globe } from "lucide-react";


export const getHealthColor = (score) => {
  if (score === null || score === undefined)
    return { bg: "rgba(255,255,255,0.04)", text: "#94A3B8", border: "rgba(255,255,255,0.1)", glow: "none" };
  if (score >= 75)
    return { bg: "rgba(16,185,129,0.08)", text: "#10B981", border: "rgba(16,185,129,0.3)", glow: "0 0 12px rgba(16,185,129,0.3)" };
  if (score >= 50)
    return { bg: "rgba(245,158,11,0.08)", text: "#F59E0B", border: "rgba(245,158,11,0.3)", glow: "none" };
  if (score >= 25)
    return { bg: "rgba(249,115,22,0.08)", text: "#F97316", border: "rgba(249,115,22,0.3)", glow: "none" };
  return { bg: "rgba(255,45,85,0.08)", text: "#FF2D55", border: "rgba(255,45,85,0.3)", glow: "0 0 12px rgba(255,45,85,0.3)" };
};

const ProjectCard = ({ project, latestSnapshot, isGitHubConnected }) => {
  const score = latestSnapshot?.health_score?.overall;
  const label = latestSnapshot?.health_score?.label || "No Sync Data";
  const colors = getHealthColor(score);
  const isPrivate = project.visibility === "private";
  const needsAuth = isPrivate && !isGitHubConnected;


  return (
    <Link to={`/projects/${project.id}`} className="block group">
      <div
        className="relative overflow-hidden rounded-2xl transition-all duration-300"
        style={{
          background: "rgba(10,15,30,0.65)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = "translateY(-4px)";
          e.currentTarget.style.borderColor = "rgba(30,144,255,0.3)";
          e.currentTarget.style.boxShadow = "0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(30,144,255,0.12), 0 0 30px rgba(30,144,255,0.06)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
          e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.35)";
        }}
      >
        {/* Top accent line */}
        <div
          className="h-px w-full"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(30,144,255,0.5), transparent)",
            opacity: 0,
            transition: "opacity 0.3s ease",
          }}
        />

        {/* Subtle corner glow */}
        <div
          className="absolute top-0 right-0 w-24 h-24 pointer-events-none"
          style={{
            background: "radial-gradient(circle at top right, rgba(30,144,255,0.06), transparent 70%)",
          }}
        />

        <div className="p-5">
          {/* Header row */}
          <div className="flex justify-between items-start mb-4 gap-3">
            <div className="min-w-0 flex-1">
              {/* Repo icon + name */}
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: needsAuth ? "rgba(245,158,11,0.1)" : "rgba(30,144,255,0.1)",
                    border: needsAuth ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(30,144,255,0.2)",
                  }}
                >
                  <Cpu size={14} style={{ color: needsAuth ? "#F59E0B" : "#1E90FF" }} />
                </div>
                <h3 className="text-base font-semibold text-white truncate group-hover:text-[#3DBBFF] transition-colors">
                  {project.name}
                </h3>
              </div>
              <div className="flex items-center gap-2 ml-10">
                <p className="text-xs flex items-center gap-1 truncate" style={{ color: "#475569" }}>
                  <GitBranch size={11} />
                  {project.repo_owner}/{project.repo_name}
                </p>
                {/* Visibility badge */}
                <span
                  className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
                  style={
                    isPrivate
                      ? { background: "rgba(245,158,11,0.1)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.2)" }
                      : { background: "rgba(16,185,129,0.07)", color: "#10B981", border: "1px solid rgba(16,185,129,0.15)" }
                  }
                >
                  {isPrivate
                    ? <><Lock size={9} /> Private</>
                    : <><Globe size={9} /> Public</>}
                </span>
              </div>
            </div>


            {/* Health score badge */}
            <div className="flex flex-col items-end flex-shrink-0">
              {score !== undefined ? (
                <>
                  <span
                    className="px-2.5 py-1 text-xs font-semibold rounded-full"
                    style={{
                      background: colors.bg,
                      color: colors.text,
                      border: `1px solid ${colors.border}`,
                      boxShadow: colors.glow,
                    }}
                  >
                    {label}
                  </span>
                  <span className="text-2xl font-bold mt-1.5 text-white" style={{ letterSpacing: "-0.03em" }}>
                    {score}
                    <span className="text-sm font-normal ml-0.5" style={{ color: "#475569" }}>/100</span>
                  </span>
                </>
              ) : (
                <span
                  className="px-2.5 py-1 text-xs font-medium rounded-full flex items-center gap-1"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#94A3B8",
                  }}
                >
                  <AlertCircle size={11} />
                  Unsynced
                </span>
              )}
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between text-xs pt-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-1.5" style={{ color: "#475569" }}>
              <Calendar size={12} />
              <span>
                {latestSnapshot
                  ? new Date(latestSnapshot.snapshot_date).toLocaleDateString()
                  : "Never synced"}
              </span>
            </div>
            <div
              className="flex items-center gap-1 font-medium transition-colors group-hover:gap-2"
              style={{ color: "#1E90FF", transition: "all 0.2s ease" }}
            >
              <Activity size={12} />
              <span>View Details</span>
              <ArrowRight size={12} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ProjectCard;
