/**
 * GitHubCallback.jsx
 *
 * OAuth return landing page — accessed at /github/callback after GitHub redirects back.
 * Reads URL params: ?status=success|cancelled|error&error_msg=...
 *
 * On success: shows branded success animation → navigates to /dashboard in 2.5s
 * On cancel/error: shows friendly message + retry button
 *
 * This route must be PUBLIC in App.jsx (no ProtectedRoute wrapper) because
 * Firebase auth state may not have settled yet when GitHub redirects back.
 */

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import RepoLensLogo from "../components/RepoLensLogo";
import GithubIcon from "../components/GithubIcon";
import { Check, X, RefreshCw, ArrowRight } from "lucide-react";

const GitHubCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(3);

  const status = searchParams.get("status") || "error";
  const errorMsg = searchParams.get("error_msg")
    ? decodeURIComponent(searchParams.get("error_msg"))
    : "An unexpected error occurred. Please try again.";

  const isSuccess   = status === "success";
  const isCancelled = status === "cancelled";

  // Auto-redirect on success
  useEffect(() => {
    if (!isSuccess) return;
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          navigate("/dashboard", { replace: true });
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isSuccess, navigate]);

  // Clean up the stored token from sessionStorage
  useEffect(() => {
    sessionStorage.removeItem("firebase_id_token_for_oauth");
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden p-6 bg-transparent"
    >

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-md w-full text-center">
        {/* Logo */}
        <div className="float-animation">
          <RepoLensLogo size="xl" showWordmark={false} />
        </div>

        {/* Status Card */}
        <div
          className="w-full rounded-2xl overflow-hidden"
          style={{
            background: "rgba(10,15,30,0.9)",
            backdropFilter: "blur(24px)",
            border: isSuccess
              ? "1px solid rgba(16,185,129,0.3)"
              : "1px solid rgba(255,45,85,0.3)",
            boxShadow: isSuccess
              ? "0 0 40px rgba(16,185,129,0.1)"
              : "0 0 40px rgba(255,45,85,0.1)",
          }}
        >
          {/* Top accent line */}
          <div
            className="h-px w-full"
            style={{
              background: isSuccess
                ? "linear-gradient(90deg, transparent, rgba(16,185,129,0.8), transparent)"
                : "linear-gradient(90deg, transparent, rgba(255,45,85,0.8), transparent)",
            }}
          />

          <div className="p-8">
            {/* Status Icon */}
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center"
              style={{
                background: isSuccess ? "rgba(16,185,129,0.12)" : "rgba(255,45,85,0.1)",
                border: isSuccess ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,45,85,0.25)",
              }}
            >
              {isSuccess ? (
                <Check size={28} style={{ color: "#10B981" }} strokeWidth={2.5} />
              ) : (
                <X size={28} style={{ color: "#FF2D55" }} strokeWidth={2.5} />
              )}
            </div>

            {/* Title */}
            <h1
              className="text-2xl font-bold mb-2"
              style={{ color: isSuccess ? "#10B981" : "#FF2D55" }}
            >
              {isSuccess
                ? "GitHub Connected!"
                : isCancelled
                ? "Authorization Cancelled"
                : "Connection Failed"}
            </h1>

            {/* Message */}
            <p className="text-sm mb-6 leading-relaxed" style={{ color: "#94A3B8" }}>
              {isSuccess
                ? "Your GitHub account has been connected to RepoLens. You can now import private and public repositories directly."
                : errorMsg}
            </p>

            {/* GitHub brand badge */}
            {isSuccess && (
              <div
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl mx-auto mb-6"
                style={{
                  background: "rgba(16,185,129,0.08)",
                  border: "1px solid rgba(16,185,129,0.2)",
                }}
              >
                <GithubIcon size={15} style={{ color: "#10B981" }} />
                <span className="text-xs font-semibold" style={{ color: "#10B981" }}>
                  Connected via GitHub OAuth
                </span>
              </div>
            )}

            {/* Success: countdown redirect */}
            {isSuccess && (
              <div>
                <button
                  onClick={() => navigate("/dashboard", { replace: true })}
                  className="btn-primary w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2 mb-3"
                >
                  Go to Dashboard
                  <ArrowRight size={15} />
                </button>
                <p className="text-xs" style={{ color: "#475569" }}>
                  Redirecting automatically in {countdown}s...
                </p>
              </div>
            )}

            {/* Error/Cancel: retry button */}
            {!isSuccess && (
              <div className="space-y-3">
                <button
                  onClick={() => navigate("/settings/github", { replace: true })}
                  className="btn-primary w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2"
                >
                  <RefreshCw size={14} />
                  Try Again
                </button>
                <button
                  onClick={() => navigate("/dashboard", { replace: true })}
                  className="btn-ghost w-full py-2.5 rounded-xl text-sm"
                >
                  Back to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GitHubCallback;
