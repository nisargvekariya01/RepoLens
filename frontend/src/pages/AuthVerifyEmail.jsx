import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { applyActionCode } from "firebase/auth";
import { auth } from "../config/firebase";
import RepoLensLogo from "../components/RepoLensLogo";
import { CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { useToast } from "../context/ToastContext";

const AuthVerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [status, setStatus] = useState("loading"); // loading, success, error
  const [errorMessage, setErrorMessage] = useState("");

  const oobCode = searchParams.get("oobCode");

  useEffect(() => {
    if (!oobCode) {
      setStatus("error");
      setErrorMessage("Invalid or missing verification code.");
      return;
    }

    const verifyCode = async () => {
      try {
        await applyActionCode(auth, oobCode);
        
        // If the user is currently logged in, force a token refresh to update their emailVerified status
        if (auth.currentUser) {
          await auth.currentUser.reload();
        }

        setStatus("success");
        showToast("Email successfully verified!", "success");
      } catch (err) {
        setStatus("error");
        if (err.code === "auth/invalid-action-code" || err.code === "auth/expired-action-code") {
          setErrorMessage("This verification link is invalid or has expired.");
        } else {
          setErrorMessage(err.message || "An error occurred during verification.");
        }
      }
    };

    verifyCode();
  }, [oobCode, showToast]);

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

        <div className="p-8 sm:p-10 text-center">
          <div className="flex flex-col items-center mb-6">
            <div className="mb-6 float-animation">
              <RepoLensLogo size="xl" showWordmark={false} />
            </div>

            {status === "loading" && (
              <>
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                  style={{ background: "rgba(30,144,255,0.1)", border: "1px solid rgba(30,144,255,0.2)" }}
                >
                  <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#1E90FF", borderTopColor: "transparent" }}></div>
                </div>
                <h1 className="text-2xl font-bold text-white mb-2 text-glow-white">
                  Verifying Email...
                </h1>
                <p className="text-sm" style={{ color: "#94A3B8" }}>
                  Please wait while we confirm your email address.
                </p>
              </>
            )}

            {status === "success" && (
              <>
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-4 float-animation"
                  style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}
                >
                  <CheckCircle size={32} style={{ color: "#10B981" }} />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2" style={{ textShadow: "0 0 10px rgba(16,185,129,0.5)" }}>
                  Email Verified!
                </h1>
                <p className="text-sm mb-6" style={{ color: "#94A3B8" }}>
                  Your email address has been successfully verified. You now have full access to RepoLens.
                </p>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="btn-primary w-full py-3 rounded-xl flex items-center justify-center gap-2"
                  style={{
                    background: "linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(30,144,255,0.2) 100%)",
                    border: "1px solid rgba(16,185,129,0.4)",
                    color: "#10B981",
                  }}
                >
                  Continue to Dashboard
                  <ArrowRight size={16} />
                </button>
              </>
            )}

            {status === "error" && (
              <>
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                  style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)" }}
                >
                  <XCircle size={32} style={{ color: "#F43F5E" }} />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2" style={{ textShadow: "0 0 10px rgba(244,63,94,0.5)" }}>
                  Verification Failed
                </h1>
                <p className="text-sm mb-6" style={{ color: "#94A3B8" }}>
                  {errorMessage}
                </p>
                <button
                  onClick={() => navigate("/login")}
                  className="btn-ghost w-full py-3 rounded-xl flex items-center justify-center gap-2"
                >
                  Return to Login
                </button>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthVerifyEmail;
