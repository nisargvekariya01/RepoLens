import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, signInWithPopup, signInWithCustomToken } from "firebase/auth";
import { auth, googleProvider } from "../config/firebase";
import { migrateLogin } from "../api/auth.api";
import RepoLensLogo from "../components/RepoLensLogo";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
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
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard");
    } catch (err) {
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found") {
        try {
          const migrationData = await migrateLogin(email, password);
          if (migrationData?.customToken) {
            await signInWithCustomToken(auth, migrationData.customToken);
            navigate("/dashboard");
            return;
          }
        } catch (migrationErr) {
          setError(migrationErr.response?.data?.error || "Login failed. Please check your credentials.");
        }
      } else {
        setError(err.message || "Login failed. Please try again.");
      }
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
          {/* Logo + Brand */}
          <div className="flex flex-col items-center mb-8">
            <div className="mb-4 float-animation">
              <RepoLensLogo size="xl" showWordmark={false} />
            </div>
            <h1 className="text-2xl font-bold text-white text-center mb-1 text-glow-white">
              Welcome to{" "}
              <span className="gradient-text-brand">RepoLens</span>
            </h1>
            <p className="text-sm text-center" style={{ color: "#94A3B8" }}>
              AI-Powered Repository Intelligence
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: "#94A3B8" }}>
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs transition-colors"
                  style={{ color: "#1E90FF" }}
                  onMouseEnter={e => e.target.style.color = "#3DBBFF"}
                  onMouseLeave={e => e.target.style.color = "#1E90FF"}
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  className="input-repolens pr-11"
                  placeholder="••••••••"
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
              className="btn-primary w-full py-3 rounded-xl flex items-center justify-center gap-2 mt-2"
              style={{ fontSize: "0.9rem" }}
            >
              {loading ? (
                <span className="shimmer-text">Authenticating...</span>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 divider-glow" />
            <span className="text-xs" style={{ color: "#475569" }}>or</span>
            <div className="flex-1 divider-glow" />
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="btn-ghost w-full py-3 rounded-xl flex items-center justify-center gap-3"
            style={{ fontSize: "0.9rem" }}
          >
            <img 
              src="https://www.svgrepo.com/show/475656/google-color.svg" 
              className="w-5 h-5" 
              alt="Google"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.insertAdjacentHTML('afterbegin', `<div class="w-5 h-5 bg-white/10 rounded flex items-center justify-center text-[8px] font-bold text-white/50">G</div>`);
              }}
            />
            Continue with Google
          </button>

          {/* Footer link */}
          <p className="mt-6 text-center text-sm" style={{ color: "#475569" }}>
            Don't have an account?{" "}
            <Link
              to="/register"
              className="font-semibold transition-colors"
              style={{ color: "#1E90FF" }}
              onMouseEnter={e => e.target.style.color = "#3DBBFF"}
              onMouseLeave={e => e.target.style.color = "#1E90FF"}
            >
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
