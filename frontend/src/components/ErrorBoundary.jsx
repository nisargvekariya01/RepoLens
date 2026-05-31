import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-card p-12 border border-neon-pink/30 bg-neon-pink/5 text-center rounded-xl my-8">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-neon-pink/20 flex items-center justify-center mb-6 border border-neon-pink/40 animate-pulse">
              <AlertTriangle size={32} className="text-neon-pink" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-text-muted mb-8 max-w-md mx-auto">
              An error occurred while rendering this section. This might be due to missing data from the GitHub API.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center px-6 py-2.5 bg-surface hover:bg-white/5 rounded-lg border border-white/10 text-white transition-all hover:glow-purple"
            >
              <RefreshCw size={18} className="mr-2" />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
