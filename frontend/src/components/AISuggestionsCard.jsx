import { CheckCircle2, Zap, Rocket } from "lucide-react";

export const AISuggestionsCard = ({ suggestionsData }) => {
  if (!suggestionsData) return null;

  return (
    <div className="glass-card p-6 h-full flex flex-col">
      <div className="flex items-center mb-6">
        <Rocket className="text-neon-purple mr-2" size={20} />
        <h3 className="text-lg font-semibold text-white text-glow">AI Recommendations</h3>
      </div>

      {suggestionsData.top_priority && (
        <div className="bg-primary/20 border border-primary/30 p-4 rounded-lg mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10">
            <Zap size={64} />
          </div>
          <p className="text-xs text-primary font-bold uppercase tracking-wider mb-1">Top Priority</p>
          <p className="text-white font-medium relative z-10 leading-relaxed">{suggestionsData.top_priority}</p>
        </div>
      )}

      {suggestionsData.quick_wins?.length > 0 && (
        <div className="mb-6">
          <p className="text-xs text-text-muted uppercase font-bold tracking-wider mb-3 flex items-center">
            <Zap size={14} className="mr-1 text-orange-400" /> Quick Wins
          </p>
          <ul className="space-y-2">
            {[...new Set(suggestionsData.quick_wins)].map((win, idx) => (
              <li key={idx} className="flex items-start text-sm text-white/90">
                <CheckCircle2 className="text-neon-green mr-2 mt-0.5 flex-shrink-0" size={16} />
                <span>{win}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex-1 space-y-4">
        {(!suggestionsData.suggestions || suggestionsData.suggestions.length === 0) ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center bg-surface/30 rounded-lg border border-dashed border-white/10">
            <CheckCircle2 className="text-neon-green/50 mb-2" size={32} />
            <p className="text-white/80 font-medium text-sm">No new recommendations</p>
            <p className="text-xs text-text-muted mt-1">The codebase looks well-optimized right now.</p>
          </div>
        ) : (
          suggestionsData.suggestions
            .filter((sugg, index, self) => index === self.findIndex((t) => t.title === sugg.title))
            .map((sugg, idx) => (
            <div key={idx} className="bg-surface/50 border border-white/10 p-4 rounded-xl hover:bg-white/5 transition-all">
              <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                <h4 className="text-sm font-semibold text-white">{sugg.title}</h4>
                <span className="bg-white/10 border border-white/10 text-text-muted text-[10px] uppercase font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                  {sugg.category?.replace(/_/g, " ")}
                </span>
              </div>
              
              <p className="text-sm text-text-muted mb-3">{sugg.action}</p>
              
              <div className="flex gap-2">
                <span className={`text-[10px] border px-2 py-0.5 rounded uppercase font-bold tracking-wider 
                  ${sugg.impact === 'high' ? 'bg-neon-green/10 text-neon-green border-neon-green/30' : 'bg-white/5 text-text-muted border-white/10'}`}>
                  Impact: {sugg.impact}
                </span>
                <span className={`text-[10px] border px-2 py-0.5 rounded uppercase font-bold tracking-wider 
                  ${sugg.effort === 'low' ? 'bg-neon-blue/10 text-neon-blue border-neon-blue/30' : 'bg-white/5 text-text-muted border-white/10'}`}>
                  Effort: {sugg.effort}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AISuggestionsCard;
