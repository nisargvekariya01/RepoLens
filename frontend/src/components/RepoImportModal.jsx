/**
 * RepoImportModal.jsx
 *
 * Full-screen modal for the GitHub repository picker.
 * Shows:
 *  - Connected account header (avatar + username + change account)
 *  - GitHubRepoPicker
 *  - Handles import action → navigates to new project
 *
 * Props:
 *   isOpen          boolean
 *   onClose()       called to close
 *   githubProfile   connected profile from useGitHubConnection
 *   onImportDone(projectId) called after successful import
 */

import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { X, Check } from "lucide-react";
import GithubIcon from "./GithubIcon";
import GitHubRepoPicker from "./GitHubRepoPicker";
import { importRepo } from "../api/github.api";

const RepoImportModal = ({ isOpen, onClose, githubProfile, onImportDone }) => {
  const navigate = useNavigate();
  const [importing, setImporting] = useState(null); // the repo currently importing
  const [importError, setImportError] = useState(null);
  const [justImported, setJustImported] = useState(null); // { name, id }

  if (!isOpen) return null;

  const handleImport = async (repo) => {
    setImporting(repo);
    setImportError(null);

    try {
      const result = await importRepo(repo);
      setJustImported({ name: repo.full_name, id: result.id });

      if (onImportDone) onImportDone(result.id);

      // Auto-navigate to the new project after a short success flash
      setTimeout(() => {
        navigate(`/projects/${result.id}`);
        onClose();
      }, 1200);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error || "Failed to import repository.";

      if (status === 409) {
        const existingId = err.response?.data?.existingProjectId;
        setImportError({
          msg,
          action: existingId
            ? { label: "Go to project →", fn: () => { navigate(`/projects/${existingId}`); onClose(); } }
            : null,
        });
      } else {
        setImportError({ msg });
      }
    } finally {
      setImporting(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(5,8,22,0.88)", backdropFilter: "blur(10px)" }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative z-10 w-full sm:max-w-2xl flex flex-col overflow-hidden"
        style={{
          background: "rgba(8,12,28,0.98)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(30,144,255,0.2)",
          borderRadius: "20px",
          boxShadow: "0 0 0 1px rgba(30,144,255,0.08), 0 32px 80px rgba(0,0,0,0.8)",
          maxHeight: "90vh",
          minHeight: "540px",
          width: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >

        {/* Top accent */}
        <div
          className="h-px w-full flex-shrink-0"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(30,144,255,0.7), rgba(139,92,246,0.4), transparent)",
          }}
        />

        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(30,144,255,0.1)", border: "1px solid rgba(30,144,255,0.2)" }}
            >
              <GithubIcon size={17} style={{ color: "#1E90FF" }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-none">Import Repository</h2>
              <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                Select a repository to analyze with RepoLens AI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Connected account pill */}
            {githubProfile && (
              <div
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{
                  background: "rgba(16,185,129,0.08)",
                  border: "1px solid rgba(16,185,129,0.2)",
                }}
              >
                <img
                  src={githubProfile.avatar_url}
                  alt={githubProfile.username}
                  className="w-5 h-5 rounded-full"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.insertAdjacentHTML('afterbegin', `<div class="w-5 h-5 rounded-full bg-surface border border-white/10 flex items-center justify-center text-[10px] font-bold text-white/50">${githubProfile.username.charAt(0).toUpperCase()}</div>`);
                  }}
                />
                <span className="text-xs font-semibold" style={{ color: "#10B981" }}>
                  @{githubProfile.username}
                </span>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-all"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#94A3B8",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Success flash ── */}
        {justImported && (
          <div
            className="mx-5 mt-4 flex-shrink-0 p-3 rounded-xl flex items-center gap-3"
            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)" }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(16,185,129,0.15)" }}
            >
              <Check size={14} style={{ color: "#10B981" }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#10B981" }}>
                {justImported.name} imported!
              </p>
              <p className="text-xs" style={{ color: "#94A3B8" }}>
                Taking you to the project...
              </p>
            </div>
          </div>
        )}

        {/* ── Error banner ── */}
        {importError && (
          <div
            className="mx-5 mt-4 flex-shrink-0 p-3 rounded-xl"
            style={{ background: "rgba(255,45,85,0.08)", border: "1px solid rgba(255,45,85,0.2)" }}
          >
            <p className="text-sm" style={{ color: "#FF2D55" }}>{importError.msg}</p>
            {importError.action && (
              <button
                onClick={importError.action.fn}
                className="text-xs mt-1 underline"
                style={{ color: "#FF2D55" }}
              >
                {importError.action.label}
              </button>
            )}
          </div>
        )}

        {/* ── Picker ── */}
        <div className="flex-1 overflow-hidden px-5 py-4 min-h-0">
          <GitHubRepoPicker onImport={handleImport} importing={importing} />
        </div>

        {/* ── Footer ── */}
        <div
          className="px-5 py-3 flex-shrink-0 flex items-center justify-between"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          <p className="text-xs" style={{ color: "#475569" }}>
            Can't find your repo?{" "}
            <a
              href="https://github.com/settings/installations"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "#1E90FF" }}
            >
              Update GitHub permissions
            </a>
          </p>
          <button onClick={onClose} className="btn-ghost px-4 py-2 rounded-lg text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RepoImportModal;
