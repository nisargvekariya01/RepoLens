import { Bell, Check, Trash2 } from "lucide-react";
import { useState } from "react";
import { markAlertRead } from "../api/dashboard.api";

const AlertBadge = ({ alert, projectId, onRead }) => {
  const [loading, setLoading] = useState(false);

  const handleMarkRead = async () => {
    try {
      setLoading(true);
      await markAlertRead(projectId, alert.id);
      onRead(alert.id);
    } catch (error) {
      console.error("Failed to mark alert as read", error);
    } finally {
      setLoading(false);
    }
  };

  const severityColors = {
    high: "bg-surface/50 border-l-4 border-l-neon-pink border-y-white/5 border-r-white/5 text-white glow-pink",
    medium: "bg-surface/50 border-l-4 border-l-orange-500 border-y-white/5 border-r-white/5 text-white",
    low: "bg-surface/50 border-l-4 border-l-neon-blue border-y-white/5 border-r-white/5 text-white glow-blue",
  };

  const bgClass = severityColors[alert.severity] || severityColors.low;

  return (
    <div className={`glass-card flex items-start p-3 rounded-lg border ${bgClass} mb-3 transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}>
      <Bell className={`mt-0.5 mr-3 flex-shrink-0 ${alert.severity === 'high' ? 'text-neon-pink' : alert.severity === 'medium' ? 'text-orange-500' : 'text-neon-blue'}`} size={18} />
      <div className="flex-1">
        <h4 className="text-sm font-semibold capitalize flex items-center">
          {alert.type} Alert
          <span className="ml-2 px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-white/10 border border-white/20 opacity-90">
            {alert.severity}
          </span>
        </h4>
        <p className="text-sm mt-1 text-text-muted">{alert.message}</p>
        <span className="text-xs text-text-muted/60 mt-2 block">
          {new Date(alert.created_at).toLocaleString()}
        </span>
      </div>
      <button 
        onClick={handleMarkRead}
        disabled={loading}
        className="ml-2 p-1.5 rounded-md hover:bg-white/10 text-text-muted hover:text-white transition-colors"
        title="Mark as read"
      >
        <Check size={16} />
      </button>
    </div>
  );
};

export default AlertBadge;
