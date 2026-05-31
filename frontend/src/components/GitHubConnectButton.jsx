/**
 * GitHubConnectButton.jsx
 *
 * Smart CTA button for the Dashboard.
 *
 * States:
 *  - Loading        → spinner
 *  - Not connected  → "Connect GitHub" → initiates OAuth flow
 *  - Connected      → "Import from GitHub" → opens RepoImportModal
 *
 * Props:
 *   github          — from useGitHubConnection hook
 *   onImportDone(projectId) — called after successful repo import
 */

import { useState } from "react";
import { ArrowRight, RefreshCw, Plus } from "lucide-react";
import GithubIcon from "./GithubIcon";
import RepoImportModal from "./RepoImportModal";
import { initiateGitHubOAuth } from "../api/github.api";

const GitHubConnectButton = ({ github, onImportDone }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [oauthLoading, setOAuthLoading] = useState(false);
  const [oauthError, setOAuthError] = useState(null);

  const handleConnect = async () => {
    setOAuthLoading(true);
    setOAuthError(null);
    try {
      await initiateGitHubOAuth();
      // Browser will redirect away — no code after this point
    } catch (err) {
      console.error("[GitHubConnectButton] OAuth init error:", err.message);
      setOAuthError(err.message || "Failed to start GitHub authentication.");
      setOAuthLoading(false);
    }
  };

  if (github.loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <RefreshCw size={14} className="animate-spin" style={{ color: "#94A3B8" }} />
        <span className="text-sm" style={{ color: "#94A3B8" }}>Loading...</span>
      </div>
    );
  }

  if (github.isConnected) {
    return (
      <>
        <button
          onClick={() => setShowPicker(true)}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
        >
          <GithubIcon size={15} />
          Import from GitHub
          <ArrowRight size={14} />
        </button>

        <RepoImportModal
          isOpen={showPicker}
          onClose={() => setShowPicker(false)}
          githubProfile={github.profile}
          onImportDone={onImportDone}
        />
      </>
    );
  }

  // Not connected
  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleConnect}
        disabled={oauthLoading}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
        style={{
          background: oauthLoading
            ? "rgba(255,255,255,0.04)"
            : "linear-gradient(135deg, rgba(30,144,255,0.15) 0%, rgba(139,92,246,0.15) 100%)",
          border: "1px solid rgba(30,144,255,0.35)",
          color: oauthLoading ? "#94A3B8" : "#3DBBFF",
          boxShadow: oauthLoading ? "none" : "0 0 20px rgba(30,144,255,0.15)",
        }}
      >
        {oauthLoading ? (
          <>
            <RefreshCw size={14} className="animate-spin" />
            Redirecting to GitHub...
          </>
        ) : (
          <>
            <GithubIcon size={15} />
            Connect GitHub
            <ArrowRight size={14} />
          </>
        )}
      </button>

      {oauthError && (
        <p className="text-xs max-w-xs text-right" style={{ color: "#FF2D55" }}>
          {oauthError}
        </p>
      )}
    </div>
  );
};

export default GitHubConnectButton;
