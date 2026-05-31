import { TrendingUp, TrendingDown, Minus, Target, Calendar, AlertTriangle, CheckCircle2 } from "lucide-react";

const ScoreBar = ({ label, score, color, delay = 0 }) => {
  if (score === null || score === undefined) return null;
  const clamp = Math.min(100, Math.max(0, Number(score)));
  const glowMap = { "#38bdf8": "shadow-[0_0_12px_rgba(56,189,248,0.6)]", "#a78bfa": "shadow-[0_0_12px_rgba(167,139,250,0.6)]", "#4ade80": "shadow-[0_0_12px_rgba(74,222,128,0.6)]", "#f472b6": "shadow-[0_0_12px_rgba(244,114,182,0.6)]" };
  const glow = glowMap[color] || "";
  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-text-muted font-medium">{label}</span>
        <span className="font-bold text-white" style={{ color }}>{clamp}/100</span>
      </div>
      <div className="w-full bg-surface border border-white/10 rounded-full h-3 overflow-hidden">
        <div
          className={`h-3 rounded-full transition-all duration-1000 ${glow}`}
          style={{ width: `${clamp}%`, background: `linear-gradient(90deg, ${color}99, ${color})` }}
        />
      </div>
    </div>
  );
};

const confidenceBadge = (confidence) => {
  const map = {
    high:   { cls: "bg-neon-green/10 text-neon-green border-neon-green/30", label: "High Confidence" },
    medium: { cls: "bg-yellow-400/10 text-yellow-400 border-yellow-400/30", label: "Medium Confidence" },
    low:    { cls: "bg-neon-pink/10 text-neon-pink border-neon-pink/30",   label: "Low Confidence" },
  };
  const s = map[confidence?.toLowerCase()] || map.medium;
  return (
    <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${s.cls}`}>
      {s.label}
    </span>
  );
};

export const AIFutureScoreCard = ({ futureScoreData, currentScore }) => {
  if (!futureScoreData) return null;

  const { predicted_score_next_month, predicted_score_3_months, predicted_score_6_months,
          prediction_confidence, key_factors = [], improvement_roadmap = [], risk_to_prediction } = futureScoreData;

  const hasAnyScore = (
    predicted_score_next_month !== null && predicted_score_next_month !== undefined ||
    predicted_score_3_months   !== null && predicted_score_3_months   !== undefined ||
    predicted_score_6_months   !== null && predicted_score_6_months   !== undefined
  );
  if (!hasAnyScore) return null;

  // Determine overall trajectory from current → 6m
  const endScore = predicted_score_6_months ?? predicted_score_3_months ?? predicted_score_next_month ?? currentScore ?? 0;
  const baseScore = currentScore ?? 0;
  const diff = endScore - baseScore;
  const TrajectoryIcon = diff > 3 ? TrendingUp : diff < -3 ? TrendingDown : Minus;
  const trajColor = diff > 3 ? "text-neon-green" : diff < -3 ? "text-neon-pink" : "text-white/60";

  return (
    <div className="glass-card p-6 flex flex-col gap-6 col-span-1 lg:col-span-2">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-neon-blue/10 border border-neon-blue/20">
            <Target size={20} className="text-neon-blue" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white text-glow">Future Score Forecast</h3>
            <p className="text-xs text-text-muted mt-0.5">AI-predicted health score trajectory</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TrajectoryIcon size={16} className={trajColor} />
          {prediction_confidence && confidenceBadge(prediction_confidence)}
        </div>
      </div>

      {/* Score bars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current */}
        {currentScore !== undefined && (
          <div className="bg-surface/40 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-text-muted uppercase font-bold tracking-wider mb-3 flex items-center gap-1.5">
              <Calendar size={12} /> Now
            </p>
            <ScoreBar label="Current Score" score={currentScore} color="#94a3b8" />
          </div>
        )}

        {/* Short term */}
        <div className="bg-surface/40 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase font-bold tracking-wider mb-3 flex items-center gap-1.5">
            <Calendar size={12} /> Next Month
          </p>
          <ScoreBar label="1-Month Forecast" score={predicted_score_next_month} color="#38bdf8" />
          {predicted_score_next_month !== null && predicted_score_next_month !== undefined && (
            <p className={`text-xs font-semibold mt-1 ${predicted_score_next_month >= (currentScore ?? 0) ? "text-neon-green" : "text-neon-pink"}`}>
              {predicted_score_next_month >= (currentScore ?? 0) ? "+" : ""}{Number(predicted_score_next_month) - (currentScore ?? 0)} pts from now
            </p>
          )}
        </div>

        {/* Mid term */}
        <div className="bg-surface/40 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase font-bold tracking-wider mb-3 flex items-center gap-1.5">
            <Calendar size={12} /> 3 Months
          </p>
          <ScoreBar label="3-Month Forecast" score={predicted_score_3_months} color="#a78bfa" />
          {predicted_score_3_months !== null && predicted_score_3_months !== undefined && (
            <p className={`text-xs font-semibold mt-1 ${predicted_score_3_months >= (currentScore ?? 0) ? "text-neon-green" : "text-neon-pink"}`}>
              {predicted_score_3_months >= (currentScore ?? 0) ? "+" : ""}{Number(predicted_score_3_months) - (currentScore ?? 0)} pts from now
            </p>
          )}
        </div>

        {/* Long term */}
        <div className="bg-surface/40 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase font-bold tracking-wider mb-3 flex items-center gap-1.5">
            <Calendar size={12} /> 6 Months
          </p>
          <ScoreBar label="6-Month Forecast" score={predicted_score_6_months} color="#4ade80" />
          {predicted_score_6_months !== null && predicted_score_6_months !== undefined && (
            <p className={`text-xs font-semibold mt-1 ${predicted_score_6_months >= (currentScore ?? 0) ? "text-neon-green" : "text-neon-pink"}`}>
              {predicted_score_6_months >= (currentScore ?? 0) ? "+" : ""}{Number(predicted_score_6_months) - (currentScore ?? 0)} pts from now
            </p>
          )}
        </div>
      </div>

      {/* Key factors + Roadmap */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {key_factors.length > 0 && (
          <div>
            <p className="text-xs text-text-muted uppercase font-bold tracking-wider mb-3">Key Influencing Factors</p>
            <ul className="space-y-2">
              {[...new Set(key_factors)].map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                  <CheckCircle2 size={14} className="text-neon-purple mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {improvement_roadmap.length > 0 && (
          <div>
            <p className="text-xs text-text-muted uppercase font-bold tracking-wider mb-3">Improvement Roadmap</p>
            <ol className="space-y-2">
              {improvement_roadmap.map((step, i) => (
                <li key={i} className="bg-surface/50 border border-white/10 rounded-lg p-3">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <span className="text-xs font-bold text-neon-blue uppercase tracking-wider">{step.timeframe}</span>
                    {step.expected_score_gain > 0 && (
                      <span className="text-xs text-neon-green font-bold">+{step.expected_score_gain} pts</span>
                    )}
                  </div>
                  <p className="text-sm text-white/80">{step.milestone}</p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Risk note */}
      {risk_to_prediction && (
        <div className="flex items-start gap-2 bg-neon-pink/5 border border-neon-pink/20 rounded-xl p-3">
          <AlertTriangle size={14} className="text-neon-pink mt-0.5 flex-shrink-0" />
          <p className="text-xs text-white/70"><span className="text-neon-pink font-semibold">Prediction Risk: </span>{risk_to_prediction}</p>
        </div>
      )}
    </div>
  );
};

export default AIFutureScoreCard;
