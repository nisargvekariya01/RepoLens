/**
 * PrivateRepoWarning.jsx
 *
 * Inline warning shown in the "Add Project" modal when a private repo
 * is detected but no GitHub account is connected.
 */

import { Lock, ArrowRight } from "lucide-react";
import GithubIcon from "./GithubIcon";
import { useNavigate } from "react-router-dom";

const PrivateRepoWarning = ({ repoFullName, onConnectClick }) => {
  const navigate = useNavigate();

  const handleConnect = () => {
    if (onConnectClick) {
      onConnectClick();
    } else {
      navigate("/settings/github");
    }
  };

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(245,158,11,0.06)",
        border: "1px solid rgba(245,158,11,0.25)",
      }}
    >
      {/* Top accent */}
      <div
        className="h-px w-full"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.6), transparent)",
        }}
      />

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.3)",
            }}
          >
            <Lock size={15} style={{ color: "#F59E0B" }} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold mb-0.5" style={{ color: "#F59E0B" }}>
              Private Repository Detected
            </p>
            {repoFullName && (
              <p className="text-xs font-mono mb-2" style={{ color: "#94A3B8" }}>
                {repoFullName}
              </p>
            )}
            <p className="text-xs mb-3" style={{ color: "#94A3B8" }}>
              This repository is private. Connect your GitHub account to allow
              RepoLens to clone and analyze it securely.
            </p>

            <button
              onClick={handleConnect}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: "rgba(30,144,255,0.1)",
                border: "1px solid rgba(30,144,255,0.3)",
                color: "#3DBBFF",
              }}
            >
              <GithubIcon size={13} />
              Connect GitHub Account
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivateRepoWarning;
