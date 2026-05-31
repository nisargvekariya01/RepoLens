import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./config/firebase";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ProjectDetail from "./pages/ProjectDetail";
import GitHubSettings from "./pages/GitHubSettings";
import GitHubCallback from "./pages/GitHubCallback";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyEmail from "./pages/VerifyEmail";
import AuthVerifyEmail from "./pages/AuthVerifyEmail";
import AuthResetPassword from "./pages/AuthResetPassword";
import AuthAction from "./pages/AuthAction";
import Home from "./pages/Home";
import { ToastProvider } from "./context/ToastContext";

import RepoLensLogo from "./components/RepoLensLogo";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import AuroraBackground from "./components/AuroraBackground";
import ScrollToTop from "./components/ScrollToTop";

const LoadingScreen = ({ message = "Loading intelligence..." }) => (
  <div
    className="min-h-screen flex flex-col items-center justify-center gap-6 relative overflow-hidden bg-transparent"
  >
    <div className="relative z-10 float-animation">
      <RepoLensLogo size="2xl" showWordmark={false} />
    </div>
    <div className="relative z-10 text-center">
      <p className="text-xl font-bold gradient-text-brand mb-1">RepoLens</p>
      <p className="text-sm shimmer-text">{message}</p>
    </div>
    <div
      className="relative z-10 w-40 h-1 rounded-full overflow-hidden"
      style={{ background: "rgba(30,144,255,0.1)" }}
    >
      <div
        className="h-full rounded-full"
        style={{
          background: "linear-gradient(90deg, #1E90FF, #3DBBFF, #8B5CF6)",
          animation: "shimmer 1.5s linear infinite",
          backgroundSize: "200% 100%",
          width: "100%",
        }}
      />
    </div>
  </div>
);

const ProtectedRoute = ({ children, user, loading, requireVerification = true }) => {
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  
  // Block access to protected routes if email is not verified
  if (requireVerification && !user.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }
  
  return children;
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serverAwake, setServerAwake] = useState(false);
  const hasPinged = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (hasPinged.current) return;
    hasPinged.current = true;

    const pingServer = async () => {
      try {
        const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000";
        const response = await axios.get(`${baseURL}/health`);
        if (response.data?.status === "ok") {
          setServerAwake(true);
        } else {
          setTimeout(pingServer, 3000);
        }
      } catch (error) {
        setTimeout(pingServer, 3000);
      }
    };
    pingServer();
  }, []);

  if (!serverAwake) {
    return (
      <div className="flex flex-col min-h-screen relative bg-[#050816] text-slate-200">
        <AuroraBackground />
        <LoadingScreen message="Waking up server... (Render free tier may take ~50s)" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <Router>
        <ScrollToTop />
        <div className="flex flex-col min-h-screen relative bg-[#050816] text-slate-200">
          <AuroraBackground />
          <Navbar user={user} loading={loading} />
          <main className="flex-grow flex flex-col relative z-20 w-full">
            <Routes>
              <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
              <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <Register />} />
              <Route path="/forgot-password" element={user ? <Navigate to="/dashboard" replace /> : <ForgotPassword />} />
              
              <Route 
                path="/verify-email" 
                element={
                  <ProtectedRoute user={user} loading={loading} requireVerification={false}>
                    <VerifyEmail />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/auth/action" 
                element={<AuthAction />} 
              />

              <Route 
                path="/auth/verify-email" 
                element={<AuthVerifyEmail />} 
              />

              <Route 
                path="/auth/reset-password" 
                element={<AuthResetPassword />} 
              />

              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute user={user} loading={loading}>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/projects/:id" 
                element={
                  <ProtectedRoute user={user} loading={loading}>
                    <ProjectDetail />
                  </ProtectedRoute>
                } 
              />

              <Route
                path="/settings/github"
                element={
                  <ProtectedRoute user={user} loading={loading}>
                    <GitHubSettings />
                  </ProtectedRoute>
                }
              />

              {/* Public OAuth callback — no auth guard, GitHub redirects here */}
              <Route path="/github/callback" element={<GitHubCallback />} />

              <Route path="/" element={<Home user={user} loading={loading} />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </ToastProvider>
  );
}

export default App;
