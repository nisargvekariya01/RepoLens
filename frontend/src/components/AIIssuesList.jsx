import { AlertTriangle, AlertCircle, Info, Hash, CheckCircle } from "lucide-react";

export const AIIssuesList = ({ issuesData }) => {
  if (!issuesData) return null;

  const getSeverityStyles = (severity) => {
    switch (severity?.toLowerCase()) {
      case "high":
        return {
          card: "border-l-neon-pink border-y-white/5 border-r-white/5",
          badge: "bg-neon-pink/10 text-neon-pink border-neon-pink/20",
          icon: <AlertCircle className="text-neon-pink mt-1" size={18} />
        };
      case "medium":
        return {
          card: "border-l-orange-500 border-y-white/5 border-r-white/5",
          badge: "bg-orange-500/10 text-orange-400 border-orange-500/20",
          icon: <AlertTriangle className="text-orange-500 mt-1" size={18} />
        };
      default:
        return {
          card: "border-l-neon-blue border-y-white/5 border-r-white/5",
          badge: "bg-neon-blue/10 text-neon-blue border-neon-blue/20",
          icon: <Info className="text-neon-blue mt-1" size={18} />
        };
    }
  };

  return (
    <div className="glass-card p-6 h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-4 text-white text-glow">Discovered Issues</h3>
      
      {issuesData.most_critical_issue && (
        <div className="bg-neon-pink/10 border border-neon-pink/30 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-neon-pink uppercase tracking-wider mb-1">Most Critical Issue</p>
          <p className="text-white font-medium">{issuesData.most_critical_issue}</p>
        </div>
      )}

      <div className="space-y-4 flex-1">
        {(!issuesData.issues_found || issuesData.issues_found.length === 0) ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center bg-surface/30 rounded-lg border border-dashed border-white/10">
            <CheckCircle className="text-neon-green/50 mb-2" size={32} />
            <p className="text-white/80 font-medium text-sm">No critical issues found</p>
            <p className="text-xs text-text-muted mt-1">The codebase appears healthy based on current analysis.</p>
          </div>
        ) : (
          issuesData.issues_found
            .filter((issue, index, self) => index === self.findIndex((t) => t.title === issue.title))
            .map((issue, idx) => {
            const styles = getSeverityStyles(issue.severity);
            return (
              <div key={idx} className={`bg-surface/50 border-l-4 p-4 rounded-lg flex items-start gap-3 transition-all hover:bg-white/5 ${styles.card}`}>
                {styles.icon}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-white">{issue.title}</h4>
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${styles.badge}`}>
                      {issue.severity}
                    </span>
                  </div>
                  <p className="text-sm text-text-muted">{issue.description}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {(issuesData.issue_patterns?.length > 0 || issuesData.estimated_tech_debt_days > 0) && (
        <div className="mt-6 pt-4 border-t border-white/10">
          {issuesData.issue_patterns?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-text-muted uppercase font-bold tracking-wider mb-2">Detected Patterns</p>
              <div className="flex flex-wrap gap-2">
                {issuesData.issue_patterns.map((pattern, idx) => (
                  <span key={idx} className="bg-white/5 border border-white/10 text-white/80 text-xs px-2 py-1 rounded-md flex items-center gap-1">
                    <Hash size={12} className="text-neon-purple" /> {pattern}
                  </span>
                ))}
              </div>
            </div>
          )}
          {issuesData.estimated_tech_debt_days > 0 && (
            <p className="text-sm text-text-muted font-medium text-right">
              Estimated Tech Debt: <span className="text-white">{issuesData.estimated_tech_debt_days} days</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default AIIssuesList;
