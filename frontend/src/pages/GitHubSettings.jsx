/**
 * GitHubSettings.jsx
 *
 * Settings page at /settings/github
 * Primary: OAuth connection + status
 * Secondary tab: PAT (personal access token) fallback
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../config/firebase";
import GithubIcon from "../components/GithubIcon";
import { useGitHubConnection } from "../hooks/useGitHubConnection";
import { initiateGitHubOAuth } from "../api/github.api";
import {
  Settings, ShieldCheck, Zap, Lock, Check, RefreshCw,
  ArrowLeft, ExternalLink, Key, AlertTriangle, LogOut
} from "lucide-react";

const GitHubSettings = () => {
  const navigate = useNavigate();
  const { profile, loading, connecting, error, connect, disconnect, validate } =
    useGitHubConnection();

  const [oauthLoading, setOAuthLoading] = useState(false);
  const [oauthError, setOAuthError] = useState(null);

  const handleOAuthConnect = async () => {
    setOAuthLoading(true);
    setOAuthError(null);
    try {
      await initiateGitHubOAuth();
    } catch (err) {
      setOAuthError(err.message || "Failed to start GitHub authorization.");
      setOAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/");
  };

  const isConnected = profile?.connected;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-transparent">

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">

        {/* Back + Page header */}
        <div className="mb-8">
          <Link to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs mb-4 transition-colors"
            style={{ color: "#475569" }}
            onMouseEnter={(e) => e.currentTarget.style.color = "#94A3B8"}
            onMouseLeave={(e) => e.currentTarget.style.color = "#475569"}
          >
            <ArrowLeft size={13} /> Back to Dashboard
          </Link>
          <div className="section-header mb-1">
            <Settings size={20} style={{ color: "#1E90FF" }} />
            <h1 className="text-2xl font-bold text-white">GitHub Integration</h1>
          </div>
          <p className="text-sm ml-1" style={{ color: "#94A3B8" }}>
            Connect your GitHub account to import and analyze private repositories
          </p>
        </div>

        <div className="space-y-6">

          {/* ── Connection status card ── */}
          {loading ? (
            <div className="glass-card p-8 flex items-center justify-center gap-3">
              <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "rgba(30,144,255,0.3)", borderTopColor: "#1E90FF" }} />
              <span className="text-sm shimmer-text">Checking connection status...</span>
            </div>
          ) : isConnected ? (
            /* ── Connected state ── */
            <div className="rounded-2xl overflow-hidden"
              style={{
                background: "rgba(10,15,30,0.7)",
                border: "1px solid rgba(16,185,129,0.25)",
                boxShadow: "0 0 0 1px rgba(16,185,129,0.06)",
              }}
            >
              <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.6), transparent)" }} />
              <div className="p-5">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <img src={profile.avatar_url} alt={profile.username}
                        className="w-14 h-14 rounded-xl"
                        style={{ border: "2px solid rgba(16,185,129,0.4)" }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.insertAdjacentHTML('afterbegin', `<div class="w-14 h-14 rounded-xl bg-surface border-2 border-neon-green/40 flex items-center justify-center text-xl font-bold text-white/50">${profile.username.charAt(0).toUpperCase()}</div>`);
                        }}
                      />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: "#10B981", border: "2px solid #050816" }}>
                        <Check size={10} color="white" strokeWidth={3} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-base font-bold text-white">@{profile.username}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#10B981" }}>
                          Connected
                        </span>
                      </div>
                      {profile.name && <p className="text-sm" style={{ color: "#94A3B8" }}>{profile.name}</p>}
                      <p className="text-xs mt-1" style={{ color: "#475569" }}>
                        via {profile.auth_method === "oauth" ? "GitHub OAuth" : "Personal Access Token"}
                        {" · "}Token ends in ···{profile.token_last4}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <button onClick={handleOAuthConnect} disabled={oauthLoading}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: "rgba(30,144,255,0.08)", border: "1px solid rgba(30,144,255,0.2)", color: "#3DBBFF" }}
                    >
                      <RefreshCw size={12} className={oauthLoading ? "animate-spin" : ""} />
                      Reconnect
                    </button>
                    <Link to="/dashboard"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                      style={{ background: "rgba(30,144,255,0.12)", border: "1px solid rgba(30,144,255,0.3)", color: "#3DBBFF" }}
                    >
                      Import Repos →
                    </Link>
                  </div>
                </div>

                {/* Scopes */}
                {profile.scopes?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="text-xs" style={{ color: "#475569" }}>Granted scopes:</span>
                    {profile.scopes.map((s) => (
                      <span key={s} className="px-2 py-0.5 rounded text-xs font-mono"
                        style={{ background: "rgba(30,144,255,0.08)", border: "1px solid rgba(30,144,255,0.2)", color: "#3DBBFF" }}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {/* Disconnect */}
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <button onClick={disconnect} disabled={connecting}
                    className="text-xs font-medium transition-all"
                    style={{ color: "#475569" }}
                    onMouseEnter={(e) => e.currentTarget.style.color = "#FF2D55"}
                    onMouseLeave={(e) => e.currentTarget.style.color = "#475569"}
                  >
                    {connecting ? "Disconnecting..." : "Disconnect GitHub account"}
                  </button>
                </div>
              </div>
            </div>

          ) : (
            /* ── Not connected ── */
            <div className="space-y-4">
              <div className="rounded-2xl overflow-hidden"
                style={{ background: "rgba(10,15,30,0.7)", border: "1px solid rgba(30,144,255,0.2)" }}>
                <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(30,144,255,0.6), rgba(139,92,246,0.3), transparent)" }} />
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(30,144,255,0.1)", border: "1px solid rgba(30,144,255,0.2)" }}>
                      <GithubIcon size={22} style={{ color: "#1E90FF" }} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Connect with GitHub</h3>
                      <p className="text-xs" style={{ color: "#94A3B8" }}>
                        Authorize RepoLens to access your repositories
                      </p>
                    </div>
                  </div>

                  <ul className="space-y-2.5 mb-6">
                    {[
                      "Access public and private repositories",
                      "Browse and import repos with one click",
                      "No manual token generation required",
                      "Revoke access anytime from GitHub settings",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2.5 text-sm" style={{ color: "#94A3B8" }}>
                        <Check size={14} style={{ color: "#10B981", flexShrink: 0 }} />
                        {item}
                      </li>
                    ))}
                  </ul>

                  {oauthError && (
                    <div className="p-3 rounded-xl text-xs mb-4 flex items-start gap-2"
                      style={{ background: "rgba(255,45,85,0.08)", border: "1px solid rgba(255,45,85,0.2)", color: "#FF2D55" }}>
                      <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                      {oauthError}
                    </div>
                  )}

                  <button onClick={handleOAuthConnect} disabled={oauthLoading}
                    className="w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                    style={{
                      background: oauthLoading
                        ? "rgba(255,255,255,0.04)"
                        : "linear-gradient(135deg, rgba(30,144,255,0.2) 0%, rgba(139,92,246,0.15) 100%)",
                      border: "1px solid rgba(30,144,255,0.4)",
                      color: oauthLoading ? "#94A3B8" : "#3DBBFF",
                      boxShadow: oauthLoading ? "none" : "0 0 24px rgba(30,144,255,0.15)",
                    }}
                  >
                    {oauthLoading ? (
                      <><RefreshCw size={15} className="animate-spin" /> Redirecting to GitHub...</>
                    ) : (
                      <><GithubIcon size={16} /> Authorize with GitHub<ExternalLink size={12} /></>
                    )}
                  </button>

                  <p className="text-xs text-center mt-3" style={{ color: "#475569" }}>
                    Scopes requested: <span className="font-mono" style={{ color: "#94A3B8" }}>read:user, repo</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* How it works */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} style={{ color: "#94A3B8" }} />
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#94A3B8" }}>
                How Private Repository Access Works
              </h2>
            </div>
            <div className="rounded-2xl p-5 space-y-4"
              style={{ background: "rgba(10,15,30,0.6)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {[
                { icon: <Lock size={14} style={{ color: "#1E90FF" }} />, title: "AES-256 Encrypted Storage", desc: "Your OAuth token is encrypted with AES-256-GCM before MongoDB storage. Never returned to the browser." },
                { icon: <GithubIcon size={14} style={{ color: "#8B5CF6" }} />, title: "Authenticated Git Clone", desc: "Private repos are cloned with x-access-token auth. Token is stripped from all logs and error messages." },
                { icon: <ShieldCheck size={14} style={{ color: "#10B981" }} />, title: "CSRF State Validation", desc: "OAuth state stored in Redis (10min TTL) prevents cross-site request forgery attacks." },
                { icon: <Zap size={14} style={{ color: "#F59E0B" }} />, title: "Same AI Pipeline", desc: "Private repos use the identical Repomix + RAG analysis pipeline as public repos. No feature differences." },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white mb-0.5">{item.title}</p>
                    <p className="text-xs leading-relaxed" style={{ color: "#94A3B8" }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* .env reference */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Key size={15} style={{ color: "#94A3B8" }} />
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#94A3B8" }}>
                Backend Configuration
              </h2>
            </div>
            <div className="rounded-2xl p-4" style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", lineHeight: "1.8",
              background: "rgba(5,8,22,0.8)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-xs mb-1" style={{ color: "#475569" }}># backend/.env</p>
              <p><span style={{ color: "#FF2D55" }}>GITHUB_CLIENT_ID</span>=<span style={{ color: "#3DBBFF" }}>Ov23li...</span></p>
              <p><span style={{ color: "#FF2D55" }}>GITHUB_CLIENT_SECRET</span>=<span style={{ color: "#3DBBFF" }}>your_secret</span></p>
              <p><span style={{ color: "#FF2D55" }}>TOKEN_ENCRYPTION_KEY</span>=<span style={{ color: "#10B981" }}>32+_char_secret</span></p>
              <p><span style={{ color: "#FF2D55" }}>FRONTEND_URL</span>=<span style={{ color: "#F59E0B" }}>http://localhost:5173</span></p>
              <p><span style={{ color: "#FF2D55" }}>BACKEND_URL</span>=<span style={{ color: "#F59E0B" }}>http://localhost:5000</span></p>
            </div>
          </div>

          {/* Subscription Settings */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} style={{ color: "#94A3B8" }} />
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#94A3B8" }}>
                Subscription Plan
              </h2>
            </div>
            <div className="rounded-2xl p-5 space-y-4"
              style={{ background: "rgba(10,15,30,0.6)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                    Current Plan: <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20 text-xs uppercase tracking-widest">Basic</span>
                  </p>
                  <p className="text-xs" style={{ color: "#94A3B8" }}>You are on the free Basic tier. Limited to 3 repositories and 5 analyses per day.</p>
                </div>
                <Link
                  to="/#pricing"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                  style={{
                    background: "rgba(168,85,247,0.1)",
                    border: "1px solid rgba(168,85,247,0.3)",
                    color: "#A855F7",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(168,85,247,0.2)";
                    e.currentTarget.style.borderColor = "rgba(168,85,247,0.5)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(168,85,247,0.1)";
                    e.currentTarget.style.borderColor = "rgba(168,85,247,0.3)";
                  }}
                >
                  <Zap size={16} />
                  <span className="text-sm font-medium">Upgrade Plan</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Account Settings */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <LogOut size={16} style={{ color: "#94A3B8" }} />
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#94A3B8" }}>
                Account
              </h2>
            </div>
            <div className="rounded-2xl p-5 space-y-4"
              style={{ background: "rgba(10,15,30,0.6)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white mb-0.5">Sign Out</p>
                  <p className="text-xs" style={{ color: "#94A3B8" }}>Log out of your RepoLens account on this device.</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200"
                  style={{
                    background: "rgba(255,45,85,0.1)",
                    border: "1px solid rgba(255,45,85,0.25)",
                    color: "#FF2D55",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(255,45,85,0.15)";
                    e.currentTarget.style.borderColor = "rgba(255,45,85,0.4)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(255,45,85,0.1)";
                    e.currentTarget.style.borderColor = "rgba(255,45,85,0.25)";
                  }}
                >
                  <LogOut size={16} />
                  <span className="text-sm font-medium">Logout</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default GitHubSettings;
