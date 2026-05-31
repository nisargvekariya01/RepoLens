import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const AuthAction = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const mode = searchParams.get('mode');

    if (mode === 'resetPassword') {
      navigate(`/auth/reset-password${location.search}`, { replace: true });
    } else if (mode === 'verifyEmail') {
      navigate(`/auth/verify-email${location.search}`, { replace: true });
    } else {
      // Fallback or unknown mode
      navigate('/login', { replace: true });
    }
  }, [location, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-sm" style={{ color: "#94A3B8" }}>Processing your request...</div>
    </div>
  );
};

export default AuthAction;
