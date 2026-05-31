/**
 * GitHubConnectCard.jsx
 *
 * Full GitHub connection management panel.
 * Shows:
 *  - Connection status with avatar + username
 *  - PAT input with live validation
 *  - Disconnect button
 *  - Scope / permission info
 */

import { useState, useRef } from "react";
import {
  Check,
  X,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Lock,
  Unlock,
} from "lucide-react";
import GithubIcon from "./GithubIcon";

const GitHubConnectCard = ({ profile, connecting, error, onConnect, onDisconnect, onValidate }) => {
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [validating, setValidating] = useState(false);
  const [preview, setPreview] = useState(null); // live validation result
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const debounceRef = useRef(null);

  const isConnected = profile?.connected;

  // Live-validate on input (debounced 600ms)
  const handleTokenChange = (val) => {
    setToken(val);
    setPreview(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length > 10) {
      debounceRef.current = setTimeout(async () => {
        setValidating(true);
        const result = await onValidate(val);
        setPreview(result);
        setValidating(false);
      }, 600);
    }
  };

  const handleConnect = async (e) => {
    e.preventDefault();
    if (!token.trim()) return;
    await onConnect(token.trim());
    setToken("");
    setPreview(null);
  };

  const handleDisconnect = async () => {
    await onDisconnect();
    setConfirmDisconnect(false);
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(10,15,30,0.7)",
        border: isConnected
          ? "1px solid rgba(16,185,129,0.25)"
          : "1px solid rgba(30,144,255,0.2)",
        boxShadow: isConnected
          ? "0 0 0 1px rgba(16,185,129,0.06), 0 4px 20px rgba(0,0,0,0.4)"
          : "0 0 0 1px rgba(30,144,255,0.06), 0 4px 20px rgba(0,0,0,0.4)",
      }}
    >
      {/* Top accent line */}
      <div
        className="h-px w-full"
        style={{
          background: isConnected
            ? "linear-gradient(90deg, transparent, rgba(16,185,129,0.6), transparent)"
            : "linear-gradient(90deg, transparent, rgba(30,144,255,0.6), rgba(255,45,85,0.3), transparent)",
        }}
      />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: isConnected
                  ? "rgba(16,185,129,0.12)"
                  : "rgba(30,144,255,0.1)",
                border: isConnected
                  ? "1px solid rgba(16,185,129,0.3)"
                  : "1px solid rgba(30,144,255,0.2)",
              }}
            >
              <GithubIcon size={18} style={{ color: isConnected ? "#10B981" : "#1E90FF" }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">GitHub Integration</h3>
              <p className="text-xs" style={{ color: "#94A3B8" }}>
                {isConnected ? "Private repos enabled" : "Connect to access private repos"}
              </p>
            </div>
          </div>

          {isConnected && (
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{
                background: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(16,185,129,0.3)",
                color: "#10B981",
              }}
            >
              <Check size={11} />
              Connected
            </span>
          )}
        </div>

        {/* ── Connected State ── */}
        {isConnected ? (
          <div className="space-y-4">
            {/* Profile card */}
            <div
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}
            >
              <img
                src={profile.avatar_url}
                alt={profile.username}
                className="w-10 h-10 rounded-full"
                style={{ border: "2px solid rgba(16,185,129,0.4)" }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.parentElement.insertAdjacentHTML('afterbegin', `<div class="w-10 h-10 rounded-full bg-surface border-2 border-neon-green/40 flex items-center justify-center text-sm font-bold text-white/50">${profile.username.charAt(0).toUpperCase()}</div>`);
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">@{profile.username}</p>
                {profile.name && (
                  <p className="text-xs truncate" style={{ color: "#94A3B8" }}>{profile.name}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: "#475569" }}>Token ends in</p>
                <p
                  className="text-sm font-mono font-bold"
                  style={{ color: "#10B981", letterSpacing: "0.1em" }}
                >
                  ···{profile.token_last4}
                </p>
              </div>
            </div>

            {/* Scopes */}
            {profile.scopes?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {profile.scopes.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 rounded text-xs font-mono"
                    style={{
                      background: "rgba(30,144,255,0.08)",
                      border: "1px solid rgba(30,144,255,0.2)",
                      color: "#3DBBFF",
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}

            {/* Security note */}
            <div
              className="flex items-start gap-2 p-2.5 rounded-lg text-xs"
              style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.1)" }}
            >
              <ShieldCheck size={13} className="mt-0.5 flex-shrink-0" style={{ color: "#10B981" }} />
              <span style={{ color: "#94A3B8" }}>
                Token encrypted with AES-256 · Never exposed in responses
              </span>
            </div>

            {/* Disconnect */}
            {!confirmDisconnect ? (
              <button
                onClick={() => setConfirmDisconnect(true)}
                className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: "rgba(255,45,85,0.06)",
                  border: "1px solid rgba(255,45,85,0.2)",
                  color: "#FF2D55",
                }}
              >
                Disconnect GitHub
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-center" style={{ color: "#F59E0B" }}>
                  ⚠️ Private repos will no longer be accessible after disconnecting.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDisconnect(false)}
                    className="flex-1 py-2 rounded-xl text-sm btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={connecting}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold"
                    style={{
                      background: "rgba(255,45,85,0.15)",
                      border: "1px solid rgba(255,45,85,0.4)",
                      color: "#FF2D55",
                    }}
                  >
                    {connecting ? "Removing..." : "Confirm"}
                  </button>
                </div>
              </div>
            )}
          </div>

        ) : (
          /* ── Disconnected State: PAT Input ── */
          <form onSubmit={handleConnect} className="space-y-4">
            {/* Error */}
            {error && (
              <div
                className="p-3 rounded-xl text-xs"
                style={{
                  background: "rgba(255,45,85,0.08)",
                  border: "1px solid rgba(255,45,85,0.25)",
                  color: "#FF2D55",
                }}
              >
                {error}
              </div>
            )}

            {/* Token input */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#94A3B8" }}>
                Personal Access Token
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <Key size={14} style={{ color: "#475569" }} />
                </div>
                <input
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => handleTokenChange(e.target.value)}
                  className="input-repolens pl-9 pr-24 font-mono text-sm"
                  placeholder="ghp_xxxxxxxxxxxx"
                  autoComplete="off"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {/* Validation indicator */}
                  {validating && (
                    <RefreshCw size={12} style={{ color: "#94A3B8" }} className="animate-spin" />
                  )}
                  {preview?.valid === true && (
                    <Check size={13} style={{ color: "#10B981" }} />
                  )}
                  {preview?.valid === false && (
                    <X size={13} style={{ color: "#FF2D55" }} />
                  )}
                  {/* Show/hide toggle */}
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    style={{ color: "#475569" }}
                  >
                    {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Live preview */}
            {preview?.valid && (
              <div
                className="flex items-center gap-2 p-2.5 rounded-xl"
                style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)" }}
              >
                <img 
                  src={preview.avatar_url} 
                  className="w-7 h-7 rounded-full" 
                  alt={preview.username} 
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.insertAdjacentHTML('afterbegin', `<div class="w-7 h-7 rounded-full bg-surface border border-white/10 flex items-center justify-center text-[10px] font-bold text-white/50">${preview.username.charAt(0).toUpperCase()}</div>`);
                  }}
                />
                <div>
                  <p className="text-xs font-semibold text-white">@{preview.username}</p>
                  <p className="text-xs" style={{ color: "#10B981" }}>
                    Token valid · {preview.hasRepoScope ? "✓ repo scope" : "⚠ repo scope missing"}
                  </p>
                </div>
              </div>
            )}

            {preview?.valid === false && preview?.error && (
              <p className="text-xs" style={{ color: "#FF2D55" }}>{preview.error}</p>
            )}

            {/* Required scopes hint */}
            <div
              className="flex items-start gap-2 p-2.5 rounded-lg text-xs"
              style={{ background: "rgba(30,144,255,0.05)", border: "1px solid rgba(30,144,255,0.12)" }}
            >
              <Lock size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#3DBBFF" }} />
              <div style={{ color: "#94A3B8" }}>
                Required scope: <span className="font-mono text-[#3DBBFF]">repo</span>
                {" "}(full private repository access)
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=RepoLens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 inline-flex items-center gap-1 underline"
                  style={{ color: "#1E90FF" }}
                >
                  Generate token <ExternalLink size={10} />
                </a>
              </div>
            </div>

            <button
              type="submit"
              disabled={connecting || !token.trim() || preview?.valid === false}
              className="btn-primary w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2"
            >
              {connecting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <GithubIcon size={14} />
                  Connect GitHub Account
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default GitHubConnectCard;
