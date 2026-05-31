import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import { auth } from "../config/firebase";
import RepoLensLogo from "../components/RepoLensLogo";
import { Eye, EyeOff, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { useToast } from "../context/ToastContext";

const AuthResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [status, setStatus] = useState("loading"); // loading, form, success, error
  const [errorMessage, setErrorMessage] = useState("");
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const oobCode = searchParams.get("oobCode");

  useEffect(() => {
    if (!oobCode) {
      setStatus("error");
      setErrorMessage("Invalid or missing password reset code.");
      return;
    }

    const verifyCode = async () => {
      try {
        const verifiedEmail = await verifyPasswordResetCode(auth, oobCode);
        setEmail(verifiedEmail);
        setStatus("form");
      } catch (err) {
        setStatus("error");
        if (err.code === "auth/invalid-action-code" || err.code === "auth/expired-action-code") {
          setErrorMessage("This password reset link is invalid or has expired.");
        } else {
          setErrorMessage(err.message || "An error occurred verifying your link.");
        }
      }
    };

    verifyCode();
  }, [oobCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      showToast("Password must be at least 6 characters.", "error");
      return;
    }
    if (password !== confirmPassword) {
      showToast("Passwords do not match.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStatus("success");
      showToast("Password successfully reset!", "success");
    } catch (err) {
      showToast(err.message || "Failed to reset password.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

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
          border: `1px solid ${status === "success" ? "rgba(16,185,129,0.2)" : status === "error" ? "rgba(244,63,94,0.2)" : "rgba(30,144,255,0.2)"}`,
          borderRadius: "20px",
          boxShadow: `0 0 0 1px ${status === "success" ? "rgba(16,185,129,0.08)" : status === "error" ? "rgba(244,63,94,0.08)" : "rgba(30,144,255,0.08)"}, 0 24px 80px rgba(0,0,0,0.6), 0 0 40px ${status === "success" ? "rgba(16,185,129,0.08)" : status === "error" ? "rgba(244,63,94,0.08)" : "rgba(30,144,255,0.08)"}`,
          overflow: "hidden",
        }}
      >
        {/* Top accent */}
        <div
          className="h-px w-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${status === "success" ? "rgba(16,185,129,0.8)" : status === "error" ? "rgba(244,63,94,0.8)" : "rgba(30,144,255,0.8)"}, transparent)`,
          }}
        />

        <div className="p-8 sm:p-10">
          <div className="flex flex-col items-center mb-6">
            <div className="mb-6 float-animation">
              <RepoLensLogo size="xl" showWordmark={false} />
            </div>

            {status === "loading" && (
              <div className="text-center">
                <div 
                  className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4"
                  style={{ background: "rgba(30,144,255,0.1)", border: "1px solid rgba(30,144,255,0.2)" }}
                >
                  <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#1E90FF", borderTopColor: "transparent" }}></div>
                </div>
                <h1 className="text-2xl font-bold text-white mb-2 text-glow-white">
                  Verifying Link...
                </h1>
                <p className="text-sm" style={{ color: "#94A3B8" }}>
                  Please wait while we securely verify your reset link.
                </p>
              </div>
            )}

            {status === "success" && (
              <div className="text-center w-full">
                <div 
                  className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 float-animation"
                  style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}
                >
                  <CheckCircle size={32} style={{ color: "#10B981" }} />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2" style={{ textShadow: "0 0 10px rgba(16,185,129,0.5)" }}>
                  Password Reset!
                </h1>
                <p className="text-sm mb-6" style={{ color: "#94A3B8" }}>
                  Your password has been successfully updated.
                </p>
                <button
                  onClick={() => navigate("/login")}
                  className="btn-primary w-full py-3 rounded-xl flex items-center justify-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(30,144,255,0.2) 100%)",
                    border: "1px solid rgba(16,185,129,0.4)",
                    color: "#10B981",
                  }}
                >
                  Return to Login
                  <ArrowRight size={16} />
                </button>
              </div>
            )}

            {status === "error" && (
              <div className="text-center w-full">
                <div 
                  className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4"
                  style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)" }}
                >
                  <XCircle size={32} style={{ color: "#F43F5E" }} />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2" style={{ textShadow: "0 0 10px rgba(244,63,94,0.5)" }}>
                  Link Invalid
                </h1>
                <p className="text-sm mb-6" style={{ color: "#94A3B8" }}>
                  {errorMessage}
                </p>
                <button
                  onClick={() => navigate("/forgot-password")}
                  className="btn-ghost w-full py-3 rounded-xl flex items-center justify-center gap-2"
                >
                  Request a new link
                </button>
              </div>
            )}

            {status === "form" && (
              <div className="w-full">
                <h1 className="text-2xl font-bold text-white text-center mb-1 text-glow-white">
                  Set New Password
                </h1>
                <p className="text-sm text-center mb-6" style={{ color: "#94A3B8" }}>
                  Resetting password for <span className="text-white">{email}</span>
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#94A3B8" }}>
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPw ? "text" : "password"}
                        required
                        className="input-repolens pr-11"
                        placeholder="Min. 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                        style={{ color: "#475569" }}
                      >
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#94A3B8" }}>
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPw ? "text" : "password"}
                        required
                        className="input-repolens pr-11"
                        placeholder="Min. 6 characters"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPw(!showConfirmPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                        style={{ color: "#475569" }}
                      >
                        {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary w-full py-3 rounded-xl flex items-center justify-center gap-2 mt-4"
                    style={{ fontSize: "0.9rem" }}
                  >
                    {isSubmitting ? (
                      <span className="shimmer-text">Saving...</span>
                    ) : (
                      <>
                        Update Password
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthResetPassword;
