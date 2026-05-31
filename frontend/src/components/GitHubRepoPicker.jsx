/**
 * GitHubRepoPicker.jsx
 *
 * Vercel-style repository browser.
 * Fetches the user's GitHub repos (paginated, searchable, filterable)
 * and lets them click "Import" to create a RepoLens project.
 *
 * Props:
 *   onImport(repo) — called when user picks a repo
 *   importing     — the repo currently being imported (or null)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  RefreshCw,
  Lock,
  Globe,
  Star,
  GitFork,
  ChevronDown,
  AlertTriangle,
  ArrowRight,
  Filter,
} from "lucide-react";
import { fetchMyRepos } from "../api/github.api";

// ─── Language color dots (subset) ────────────────────────────────────────────
const LANG_COLORS = {
  JavaScript: "#F7DF1E", TypeScript: "#3178C6", Python: "#3572A5",
  Java: "#B07219", Go: "#00ADD8", Rust: "#DEA584", "C++": "#F34B7D",
  C: "#555555", Ruby: "#701516", PHP: "#4F5D95", Swift: "#FA7343",
  Kotlin: "#7F52FF", Shell: "#89E051", CSS: "#563D7C", HTML: "#E44B23",
  Vue: "#41B883", Dart: "#00B4AB",
};

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const FILTERS = ["all", "public", "private"];

const GitHubRepoPicker = ({ onImport, importing }) => {
  const [repos, setRepos] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [visibility, setVisibility] = useState("all");
  const debounceRef = useRef(null);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
      setRepos([]);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Reset when visibility changes
  useEffect(() => {
    setPage(1);
    setRepos([]);
  }, [visibility]);

  const loadRepos = useCallback(
    async (pageNum = 1, append = false) => {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      try {
        const data = await fetchMyRepos(pageNum, 30, debouncedSearch, visibility);
        setRepos((prev) => (append ? [...prev, ...data.repos] : data.repos));
        setHasNextPage(data.hasNextPage);
        setPage(pageNum);
      } catch (err) {
        const msg =
          err.response?.data?.error || "Failed to load repositories. Please try again.";
        setError(msg);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedSearch, visibility]
  );

  useEffect(() => { loadRepos(1, false); }, [loadRepos]);

  const handleLoadMore = () => loadRepos(page + 1, true);

  const handleRefresh = () => {
    setPage(1);
    setRepos([]);
    loadRepos(1, false);
  };

  return (
    <div className="flex flex-col h-full">

      {/* Search + Filter bar */}
      <div className="flex gap-2 mb-4 flex-shrink-0">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "#475569" }}
          />
          <input
            type="text"
            placeholder="Search repositories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl"
            style={{
              background: "rgba(10,15,30,0.8)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#E6F1FF",
              outline: "none",
            }}
            onFocus={(e) => (e.target.style.borderColor = "rgba(30,144,255,0.4)")}
            onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
          />
        </div>

        {/* Visibility filter */}
        <div className="flex rounded-xl overflow-hidden flex-shrink-0"
          style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(10,15,30,0.8)" }}
        >
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setVisibility(f)}
              className="px-3 py-2 text-xs font-medium capitalize transition-all"
              style={{
                background: visibility === f ? "rgba(30,144,255,0.15)" : "transparent",
                color: visibility === f ? "#3DBBFF" : "#94A3B8",
                borderRight: f !== "private" ? "1px solid rgba(255,255,255,0.06)" : "none",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="p-2.5 rounded-xl transition-all flex-shrink-0"
          style={{
            background: "rgba(10,15,30,0.8)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#94A3B8",
          }}
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Repo List */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-1.5 pr-1">

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="p-4 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  animation: `pulse 1.5s ease-in-out ${i * 0.1}s infinite`,
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg" style={{ background: "rgba(255,255,255,0.06)" }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 rounded" style={{ background: "rgba(255,255,255,0.06)", width: `${50 + i * 8}%` }} />
                    <div className="h-2.5 rounded" style={{ background: "rgba(255,255,255,0.04)", width: "40%" }} />
                  </div>
                  <div className="w-16 h-8 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div
            className="p-4 rounded-xl text-sm"
            style={{
              background: "rgba(255,45,85,0.07)",
              border: "1px solid rgba(255,45,85,0.2)",
              color: "#FF2D55",
            }}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">Failed to load repositories</p>
                <p className="text-xs" style={{ color: "#94A3B8" }}>{error}</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              className="mt-3 text-xs font-semibold underline"
              style={{ color: "#FF2D55" }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && repos.length === 0 && (
          <div className="py-12 text-center">
            <Search size={28} className="mx-auto mb-3" style={{ color: "#475569" }} />
            <p className="text-sm font-semibold text-white mb-1">
              {search ? `No repositories matching "${search}"` : "No repositories found"}
            </p>
            <p className="text-xs" style={{ color: "#94A3B8" }}>
              {visibility !== "all"
                ? `Try switching to "all" repositories`
                : "Make sure your GitHub account has repositories"}
            </p>
          </div>
        )}

        {/* Repo rows */}
        {!loading && repos.map((repo) => {
          const isImporting = importing?.id === repo.id;
          const langColor = LANG_COLORS[repo.language] || "#94A3B8";

          return (
            <div
              key={repo.id}
              className="group flex items-center gap-3 p-3.5 rounded-xl transition-all"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.06)",
                cursor: "default",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(30,144,255,0.05)";
                e.currentTarget.style.borderColor = "rgba(30,144,255,0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.025)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
              }}
            >
              {/* Owner avatar */}
              <img
                src={repo.owner_avatar}
                alt={repo.owner}
                className="w-9 h-9 rounded-lg flex-shrink-0"
                style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                onError={(e) => {
                  e.target.style.display = "none";
                  e.target.nextSibling && (e.target.nextSibling.style.display = "flex");
                }}
              />
              {/* Fallback if avatar fails to load */}
              <div
                className="w-9 h-9 rounded-lg flex-shrink-0 items-center justify-center text-xs font-bold hidden"
                style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(30,144,255,0.1)", color: "#1E90FF" }}
              >
                {repo.owner?.[0]?.toUpperCase()}
              </div>


              {/* Repo info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-white truncate">
                    {repo.owner_type === "Organization" ? (
                      <span style={{ color: "#94A3B8" }}>{repo.owner}/</span>
                    ) : null}
                    {repo.name}
                  </span>

                  {/* Visibility badge */}
                  <span
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0"
                    style={
                      repo.visibility === "private"
                        ? { background: "rgba(245,158,11,0.1)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.2)" }
                        : { background: "rgba(16,185,129,0.07)", color: "#10B981", border: "1px solid rgba(16,185,129,0.15)" }
                    }
                  >
                    {repo.visibility === "private"
                      ? <><Lock size={9} /> Private</>
                      : <><Globe size={9} /> Public</>}
                  </span>

                  {repo.fork && (
                    <span
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs"
                      style={{ background: "rgba(255,255,255,0.04)", color: "#475569", border: "1px solid rgba(255,255,255,0.07)" }}
                    >
                      <GitFork size={9} /> Fork
                    </span>
                  )}
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {repo.language && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: "#94A3B8" }}>
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: langColor }} />
                      {repo.language}
                    </span>
                  )}
                  {repo.stargazers_count > 0 && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: "#94A3B8" }}>
                      <Star size={10} />
                      {repo.stargazers_count.toLocaleString()}
                    </span>
                  )}
                  <span className="text-xs" style={{ color: "#475569" }}>
                    {timeAgo(repo.updated_at)}
                  </span>
                </div>

                {repo.description && (
                  <p className="text-xs mt-1 truncate" style={{ color: "#475569" }}>
                    {repo.description}
                  </p>
                )}
              </div>

              {/* Import button */}
              <button
                onClick={() => onImport(repo)}
                disabled={isImporting || !!importing}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: isImporting
                    ? "rgba(30,144,255,0.1)"
                    : "rgba(30,144,255,0.08)",
                  border: isImporting
                    ? "1px solid rgba(30,144,255,0.3)"
                    : "1px solid rgba(30,144,255,0.2)",
                  color: isImporting ? "#94A3B8" : "#3DBBFF",
                  opacity: importing && !isImporting ? 0.5 : 1,
                  cursor: importing && !isImporting ? "not-allowed" : "pointer",
                  minWidth: "76px",
                  justifyContent: "center",
                }}
              >
                {isImporting ? (
                  <>
                    <RefreshCw size={11} className="animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    Import
                    <ArrowRight size={11} />
                  </>
                )}
              </button>
            </div>
          );
        })}

        {/* Load more */}
        {!loading && !error && hasNextPage && (
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="w-full mt-2 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#94A3B8",
            }}
          >
            {loadingMore ? (
              <><RefreshCw size={13} className="animate-spin" /> Loading...</>
            ) : (
              <><ChevronDown size={14} /> Load more repositories</>
            )}
          </button>
        )}

        {/* Repo count footer */}
        {!loading && repos.length > 0 && (
          <p className="text-center text-xs pt-2 pb-1" style={{ color: "#475569" }}>
            Showing {repos.length} repositor{repos.length === 1 ? "y" : "ies"}
            {debouncedSearch ? ` matching "${debouncedSearch}"` : ""}
          </p>
        )}
      </div>
    </div>
  );
};

export default GitHubRepoPicker;
