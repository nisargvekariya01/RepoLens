import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendEmailVerification } from "firebase/auth";
import { auth } from "../config/firebase";
import RepoLensLogo from "../components/RepoLensLogo";
import { Mail, RefreshCw, LogOut, ArrowRight } from "lucide-react";
import { useToast } from "../context/ToastContext";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);

  const user = auth.currentUser;

  const handleResend = async () => {
    if (!user) return;
    setResending(true);
    try {
      const actionCodeSettings = {
        url: 'https://repolens07.vercel.app/auth/action',
        handleCodeInApp: true,
      };
      await sendEmailVerification(user, actionCodeSettings);
      showToast("Verification email resent successfully. Please check your inbox.", "success");
    } catch (err) {
      if (err.code === 'auth/too-many-requests') {
        showToast("We've already sent an email recently. Please wait a moment before trying again.", "error");
      } else {
        showToast(err.message || "Failed to resend verification email.", "error");
      }
    } finally {
      setResending(false);
    }
  };

  const handleCheckVerification = async () => {
    if (!user) return;
    setChecking(true);
    try {
      // Force refresh the user token and profile to get the latest emailVerified status
      await user.reload();
      if (user.emailVerified) {
        showToast("Email verified successfully!", "success");
        // Force navigate to dashboard
        window.location.href = "/dashboard";
      } else {
        showToast("Your email has not been verified yet. Please check your inbox.", "info");
      }
    } catch (err) {
      showToast(err.message || "Failed to check verification status.", "error");
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/login");
  };

  if (!user) {
    return null; // Will be handled by ProtectedRoute
  }

  // If they are somehow verified and land here, just redirect them
  if (user.emailVerified) {
    navigate("/dashboard");
    return null;
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden bg-transparent"
    >

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-md mx-4"
        style={{
          background: "rgba(10,15,30,0.75)",
          backdropFilter: "blur(24px) saturate(1.8)",
          WebkitBackdropFilter: "blur(24px) saturate(1.8)",
          border: "1px solid rgba(30,144,255,0.2)",
          borderRadius: "20px",
          boxShadow: "0 0 0 1px rgba(30,144,255,0.08), 0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(30,144,255,0.08)",
          overflow: "hidden",
        }}
      >
        {/* Top accent */}
        <div
          className="h-px w-full"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.8), rgba(30,144,255,0.5), transparent)",
          }}
        />

        <div className="p-8 sm:p-10 text-center">
          <div className="flex flex-col items-center mb-6">
            <div className="mb-6 float-animation">
              <RepoLensLogo size="xl" showWordmark={false} />
            </div>
            
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}
            >
              <Mail size={32} style={{ color: "#10B981" }} />
            </div>

            <h1 className="text-2xl font-bold text-white mb-2 text-glow-white">
              Verify your email
            </h1>
            <p className="text-sm" style={{ color: "#94A3B8" }}>
              We've sent a verification link to<br/>
              <span className="font-semibold text-white mt-1 block">{user.email}</span>
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleCheckVerification}
              disabled={checking}
              className="btn-primary w-full py-3.5 rounded-xl flex items-center justify-center gap-2 font-semibold"
              style={{
                background: "linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(30,144,255,0.2) 100%)",
                border: "1px solid rgba(16,185,129,0.4)",
                color: "#10B981",
                boxShadow: "0 0 20px rgba(16,185,129,0.15)",
                fontSize: "0.9rem",
              }}
            >
              {checking ? (
                <span className="shimmer-text">Checking status...</span>
              ) : (
                <>
                  I've verified my email
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <button
              onClick={handleResend}
              disabled={resending}
              className="btn-ghost w-full py-3 rounded-xl flex items-center justify-center gap-2"
              style={{ fontSize: "0.9rem" }}
            >
              <RefreshCw size={15} className={resending ? "animate-spin" : ""} />
              {resending ? "Sending..." : "Resend verification email"}
            </button>
          </div>

          <div className="mt-8 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              onClick={handleLogout}
              className="text-sm flex items-center justify-center gap-2 mx-auto transition-colors"
              style={{ color: "#475569" }}
              onMouseEnter={(e) => e.currentTarget.style.color = "#FF2D55"}
              onMouseLeave={(e) => e.currentTarget.style.color = "#475569"}
            >
              <LogOut size={14} />
              Sign out and use a different account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
