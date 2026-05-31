import { ShieldAlert, AlertOctagon } from "lucide-react";

export const AIRiskCard = ({ riskData }) => {
  if (!riskData) return null;

  const getRiskLevelStyles = (level) => {
    switch (level?.toLowerCase()) {
      case "critical": return "text-neon-pink bg-neon-pink/10 border-neon-pink/30";
      case "high": return "text-neon-pink bg-neon-pink/10 border-neon-pink/25";
      case "medium": return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
      case "low": return "text-neon-green bg-neon-green/10 border-neon-green/20";
      default: return "text-white/80 bg-white/10 border-white/20";
    }
  };

  const overviewStyle = getRiskLevelStyles(riskData.risk_level);

  return (
    <div className="glass-card p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-white text-glow flex items-center">
          <ShieldAlert className="mr-2 text-text-muted" size={20} />
          Risk Assessment
        </h3>
        {riskData.risk_level && (
           <span className={`px-3 py-1 rounded border uppercase text-xs font-bold tracking-wider ${overviewStyle}`}>
             {riskData.risk_level} Risk
           </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-surface/50 border border-white/10 p-4 rounded-xl">
          <p className="text-xs text-text-muted uppercase font-bold tracking-wider mb-1">Bus Factor Risk</p>
          <p className="text-sm text-white font-medium">{riskData.bus_factor_risk || "Unknown"}</p>
        </div>
        <div className="bg-surface/50 border border-white/10 p-4 rounded-xl">
          <p className="text-xs text-text-muted uppercase font-bold tracking-wider mb-1">Abandonment Prob.</p>
          <p className="text-sm text-white font-medium capitalize flex items-center">
            {riskData.abandonment_probability === 'high' && <AlertOctagon size={14} className="text-red-500 mr-1" />}
            {riskData.abandonment_probability || "Unknown"}
          </p>
        </div>
      </div>

      {(!riskData.risks || riskData.risks.length === 0) ? (
        <div className="mb-6 flex-1 flex flex-col items-center justify-center p-6 bg-surface/30 rounded-xl border border-dashed border-white/10 text-center">
          <ShieldAlert className="text-neon-green/50 mb-2" size={28} />
          <p className="text-white/80 font-medium text-sm">No critical risks detected</p>
          <p className="text-xs text-text-muted mt-1">Architecture and patterns appear stable.</p>
        </div>
      ) : (
        <div className="mb-6 flex-1">
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-text-muted">Domain</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-text-muted">LxI</th>
                  <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-text-muted">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 opacity-90">
                {riskData.risks
                  .filter((risk, index, self) => index === self.findIndex((t) => t.name === risk.name))
                  .map((risk, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 text-sm text-white font-medium whitespace-nowrap">{risk.name}</td>
                    <td className="py-3 px-4 text-xs text-text-muted capitalize whitespace-nowrap">
                      {risk.likelihood?.charAt(0)} × {risk.impact?.charAt(0)}
                    </td>
                    <td className="py-3 px-4 text-sm text-text-muted">{risk.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {riskData.recommended_actions?.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mt-auto">
          <p className="text-xs text-text-muted uppercase font-bold tracking-wider mb-3">Mitigation Actions</p>
          <ol className="list-decimal list-inside space-y-1.5 marker:text-neon-purple marker:font-bold">
            {[...new Set(riskData.recommended_actions)].map((act, idx) => (
              <li key={idx} className="text-sm text-white/90 pl-1">{act}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

export default AIRiskCard;
