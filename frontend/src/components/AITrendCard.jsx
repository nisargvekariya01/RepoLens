import { TrendingUp, TrendingDown, Minus, Target } from "lucide-react";

export const AITrendCard = ({ trendData }) => {
  if (!trendData) return null;

  const getDirectionBadge = (direction) => {
    switch (direction?.toLowerCase()) {
      case "improving":
        return (
          <span className="flex items-center gap-1 bg-neon-green/10 text-neon-green border border-neon-green/30 px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider glow-green">
            <TrendingUp size={14} /> Improving
          </span>
        );
      case "declining":
        return (
          <span className="flex items-center gap-1 bg-neon-pink/10 text-neon-pink border border-neon-pink/30 px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider glow-pink">
            <TrendingDown size={14} /> Declining
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 bg-white/10 text-white/80 border border-white/20 px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider">
            <Minus size={14} /> {direction || "Stable"}
          </span>
        );
    }
  };

  return (
    <div className="glass-card p-6 h-full flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-white text-glow">Trend Analysis</h3>
        {getDirectionBadge(trendData.trend_direction)}
      </div>

      <p className="text-sm text-text-muted mb-6 leading-relaxed">
        {trendData.trend_summary}
      </p>

      {trendData.key_inflection_points?.length > 0 && (
        <div className="mb-6 flex-1">
          <p className="text-xs text-text-muted uppercase font-bold tracking-wider mb-3">Key Inflection Points</p>
          <ul className="space-y-3 relative before:absolute before:inset-y-0 before:left-[7px] before:w-[2px] before:bg-white/10">
            {[...new Set(trendData.key_inflection_points)].map((pt, idx) => (
              <li key={idx} className="relative pl-6 text-sm text-white/90">
                <span className="absolute left-[3px] top-1.5 w-[10px] h-[10px] rounded-full bg-neon-purple shadow-[0_0_10px_rgba(168,85,247,0.8)]"></span>
                {pt}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto">
        <div className="flex items-center gap-2 mb-3">
          <Target size={16} className="text-neon-blue" />
          <p className="text-xs text-text-muted uppercase font-bold tracking-wider">Velocity Assessment</p>
        </div>
        <p className="text-sm text-white/90 font-medium bg-white/5 p-3 rounded-lg border border-white/10">
          {trendData.velocity_assessment}
        </p>
      </div>
    </div>
  );
};

export default AITrendCard;
