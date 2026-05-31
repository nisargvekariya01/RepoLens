import { Link, useLocation } from "react-router-dom";
import { Zap, Settings, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../config/firebase";
import RepoLensLogo from "./RepoLensLogo";
import { useGitHubConnection } from "../hooks/useGitHubConnection";

const Navbar = ({ user: propUser, loading: propLoading }) => {
  const github = useGitHubConnection();
  const location = useLocation();
  const isHome = location.pathname === "/";
  
  const [localUser, setLocalUser] = useState(null);
  const [localLoading, setLocalLoading] = useState(true);

  useEffect(() => {
    if (propUser !== undefined) return; // Parent is handling auth state
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setLocalUser(currentUser);
      setLocalLoading(false);
    });
    return () => unsubscribe();
  }, [propUser]);

  const user = propUser !== undefined ? propUser : localUser;
  const loading = propLoading !== undefined ? propLoading : localLoading;

  return (
    <nav
      className="sticky top-0 z-50 border-b"
      style={{
        background: "rgba(5,8,22,0.85)",
        backdropFilter: "blur(20px) saturate(1.8)",
        WebkitBackdropFilter: "blur(20px) saturate(1.8)",
        borderColor: "rgba(255,255,255,0.07)",
        boxShadow: "0 1px 0 rgba(30,144,255,0.08), 0 4px 20px rgba(0,0,0,0.4)",
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(30,144,255,0.6) 30%, rgba(255,45,85,0.4) 70%, transparent 100%)",
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center relative">

          {/* Brand - Left */}
          <Link 
            to={isHome ? "/" : (user ? "/dashboard" : "/")} 
            className="group relative z-10"
            onClick={(e) => {
              if (isHome) {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
                if (window.location.hash) {
                  window.history.pushState(null, "", "/");
                }
              }
            }}
          >
            <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative">
              <RepoLensLogo size="md" showWordmark={true} />
            </div>
          </Link>

          {/* Center Links */}
          {isHome && (
            <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
               <a href="/#features" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Features</a>
               <a href="/#how-it-works" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">How It Works</a>
               <a href="/#pricing" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Pricing</a>
            </div>
          )}
          
          {/* Right side */}
          <div className="flex items-center gap-4 relative z-10">
            {loading ? (
              <div className="w-24 h-8 rounded-xl shimmer-text flex items-center justify-center text-sm font-medium glass">Loading...</div>
            ) : !user ? (
              <>
                <Link to="/login" className="hidden sm:block btn-ghost px-4 py-2 rounded-xl text-sm font-medium">
                  Login
                </Link>
                <Link to="/register" className="btn-primary px-4 py-2 rounded-xl text-sm font-medium">
                  Get Started
                </Link>
              </>
            ) : (
              <>
                {location.pathname === "/" ? (
                  <div className="flex items-center gap-4">
                    <Link to="/dashboard" className="hidden sm:flex btn-primary px-4 py-2 rounded-xl text-sm font-medium items-center gap-2">
                      Dashboard
                    </Link>
                    {/* User Dropdown / Settings */}
                    <Link
                      to="/settings/github"
                      className="w-9 h-9 rounded-full flex items-center justify-center transition-all bg-white/5 border border-white/10 hover:bg-blue-500/10 hover:border-blue-500/30 hover:text-blue-400 text-slate-400"
                      title="Settings"
                    >
                      <Settings size={18} />
                    </Link>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                      {github.profile?.connected ? (
                        <>
                          <img 
                            src={github.profile.avatar_url} 
                            alt={github.profile.username} 
                            className="w-6 h-6 rounded-full border border-emerald-500/50"
                          />
                          <span className="text-sm font-medium text-emerald-400">@{github.profile.username}</span>
                        </>
                      ) : (
                        <>
                          <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                          <span className="text-sm font-medium text-rose-400">Not Connected</span>
                        </>
                      )}
                    </div>
                    {/* Settings Icon */}
                    <Link
                      to="/settings/github"
                      className="w-9 h-9 rounded-full flex items-center justify-center transition-all bg-white/5 border border-white/10 hover:bg-blue-500/10 hover:border-blue-500/30 hover:text-blue-400 text-slate-400"
                      title="Settings"
                    >
                      <Settings size={18} />
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
