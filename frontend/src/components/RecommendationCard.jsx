import { ChevronRight, AlertTriangle, LightbulbIcon, ShieldAlert } from "lucide-react";

export const RecommendationCard = ({ recommendation }) => {
  const getIcon = () => {
    switch (recommendation.severity) {
      case "high": return <ShieldAlert className="text-red-500 mt-1 flex-shrink-0" size={20} />;
      case "medium": return <AlertTriangle className="text-orange-500 mt-1 flex-shrink-0" size={20} />;
      default: return <LightbulbIcon className="text-blue-500 mt-1 flex-shrink-0" size={20} />;
    }
  };

  const getBorderColor = () => {
    switch (recommendation.severity) {
      case "high": return "border-l-4 border-l-red-500";
      case "medium": return "border-l-4 border-l-orange-500";
      default: return "border-l-4 border-l-blue-500";
    }
  };

  return (
    <div className={`glass-card p-4 mb-3 border-l-4 ${getBorderColor()} hover:-translate-y-1 hover:brightness-110`}>
      <div className="flex items-start">
        {getIcon()}
        <div className="ml-3 flex-1">
          <h4 className="text-sm font-semibold text-white capitalize flex items-center">
            {recommendation.type} Insight
            <span className={`ml-2 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border
              ${recommendation.severity === 'high' ? 'bg-neon-pink/10 text-neon-pink border-neon-pink/20 glow-pink' : 
                recommendation.severity === 'medium' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-neon-blue/10 text-neon-blue border-neon-blue/20 glow-blue'}`}>
              {recommendation.severity}
            </span>
          </h4>
          <p className="text-sm text-text-muted mt-1.5 leading-relaxed">{recommendation.message}</p>
        </div>
      </div>
    </div>
  );
};

export default RecommendationCard;
