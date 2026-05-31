import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, signInWithPopup, sendEmailVerification } from "firebase/auth";
import { auth, googleProvider } from "../config/firebase";
import { useToast } from "../context/ToastContext";
import RepoLensLogo from "../components/RepoLensLogo";
import { Eye, EyeOff, ArrowRight, Sparkles } from "lucide-react";

const Register = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      const actionCodeSettings = {
        url: `${window.location.origin}/auth/verify-email`,
        handleCodeInApp: true,
      };
      
      await sendEmailVerification(userCredential.user, actionCodeSettings);
      showToast("Account created! Please check your email for a verification link.", "success");
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
      showToast(err.message || "Registration failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Google Sign-In failed.");
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
          border: "1px solid rgba(139,92,246,0.2)",
          borderRadius: "20px",
          boxShadow: "0 0 0 1px rgba(139,92,246,0.08), 0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(139,92,246,0.06)",
          overflow: "hidden",
        }}
      >
        {/* Top accent — purple-to-blue for register */}
        <div
          className="h-px w-full"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.8), rgba(30,144,255,0.5), transparent)",
          }}
        />

        <div className="p-8 sm:p-10">
          {/* Logo + Brand */}
          <div className="flex flex-col items-center mb-8">
            <div className="mb-4 float-animation">
              <RepoLensLogo size="xl" showWordmark={false} />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={16} style={{ color: "#8B5CF6" }} />
              <h1 className="text-2xl font-bold text-white text-glow-white">
                Join <span className="gradient-text-brand">RepoLens</span>
              </h1>
              <Sparkles size={16} style={{ color: "#1E90FF" }} />
            </div>
            <p className="text-sm text-center" style={{ color: "#94A3B8" }}>
              Start analyzing your repositories with AI
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              className="mb-5 p-3 rounded-xl text-sm text-center"
              style={{
                background: "rgba(255,45,85,0.08)",
                border: "1px solid rgba(255,45,85,0.25)",
                color: "#FF2D55",
              }}
            >
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#94A3B8" }}>
                Email
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

            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#94A3B8" }}>
                Password
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl flex items-center justify-center gap-2 mt-2 font-semibold"
              style={{
                background: "linear-gradient(135deg, #8B5CF6, #1E90FF)",
                color: "white",
                border: "1px solid rgba(139,92,246,0.4)",
                boxShadow: "0 0 20px rgba(139,92,246,0.3)",
                fontSize: "0.9rem",
                transition: "all 0.25s ease",
              }}
            >
              {loading ? (
                <span className="shimmer-text">Creating account...</span>
              ) : (
                <>
                  Create Free Account
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 divider-glow" />
            <span className="text-xs" style={{ color: "#475569" }}>or</span>
            <div className="flex-1 divider-glow" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="btn-ghost w-full py-3 rounded-xl flex items-center justify-center gap-3"
            style={{ fontSize: "0.9rem" }}
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
            Continue with Google
          </button>

          <p className="mt-6 text-center text-sm" style={{ color: "#475569" }}>
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold transition-colors"
              style={{ color: "#8B5CF6" }}
              onMouseEnter={e => e.target.style.color = "#A78BFA"}
              onMouseLeave={e => e.target.style.color = "#8B5CF6"}
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
