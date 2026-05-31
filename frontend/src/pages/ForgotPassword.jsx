import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../config/firebase";
import RepoLensLogo from "../components/RepoLensLogo";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { useToast } from "../context/ToastContext";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const actionCodeSettings = {
        url: 'https://repolens07.vercel.app/auth/action',
        handleCodeInApp: true,
      };
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      setSuccess(true);
      showToast("Password reset email sent. Please check your inbox.", "success");
    } catch (err) {
      showToast(err.message || "Failed to send reset email.", "error");
    } finally {
      setLoading(false);
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
            background: "linear-gradient(90deg, transparent, rgba(30,144,255,0.8), rgba(255,45,85,0.5), transparent)",
          }}
        />

        <div className="p-8 sm:p-10">
          <Link to="/login"
            className="inline-flex items-center gap-1.5 text-xs mb-6 transition-colors"
            style={{ color: "#475569" }}
            onMouseEnter={(e) => e.currentTarget.style.color = "#94A3B8"}
            onMouseLeave={(e) => e.currentTarget.style.color = "#475569"}
          >
            <ArrowLeft size={13} /> Back to Login
          </Link>

          {/* Logo + Brand */}
          <div className="flex flex-col items-center mb-8">
            <div className="mb-4 float-animation">
              <RepoLensLogo size="xl" showWordmark={false} />
            </div>
            <h1 className="text-2xl font-bold text-white text-center mb-1 text-glow-white">
              Reset Password
            </h1>
            <p className="text-sm text-center" style={{ color: "#94A3B8" }}>
              Enter your email to receive reset instructions
            </p>
          </div>

          {success ? (
            <div className="text-center space-y-6">
              <div
                className="p-4 rounded-xl text-sm"
                style={{
                  background: "rgba(16,185,129,0.08)",
                  border: "1px solid rgba(16,185,129,0.25)",
                  color: "#10B981",
                }}
              >
                Check your email for a link to reset your password. If it doesn't appear within a few minutes, check your spam folder.
              </div>
              <button
                onClick={() => navigate("/login")}
                className="btn-primary w-full py-3 rounded-xl flex items-center justify-center gap-2"
                style={{ fontSize: "0.9rem" }}
              >
                Return to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#94A3B8" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  className="input-repolens"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="btn-primary w-full py-3 rounded-xl flex items-center justify-center gap-2 mt-2"
                style={{ fontSize: "0.9rem" }}
              >
                {loading ? (
                  <span className="shimmer-text">Sending...</span>
                ) : (
                  <>
                    Send Reset Link
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
