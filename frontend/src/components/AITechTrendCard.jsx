import { ExternalLink, Sparkles, Flame, TrendingUp, Minus, TrendingDown, Globe, GitBranch } from "lucide-react";

const trendIcon = (status) => {
  switch (status) {
    case "hot":      return <Flame size={12} className="text-orange-400" />;
    case "rising":   return <TrendingUp size={12} className="text-neon-green" />;
    case "stable":   return <Minus size={12} className="text-white/50" />;
    case "declining":return <TrendingDown size={12} className="text-neon-pink" />;
    default:         return null;
  }
};

const trendBadge = (status) => {
  const map = {
    hot:      "bg-orange-500/15 text-orange-400 border-orange-500/30",
    rising:   "bg-neon-green/10 text-neon-green border-neon-green/30",
    stable:   "bg-white/5 text-white/50 border-white/10",
    declining:"bg-neon-pink/10 text-neon-pink border-neon-pink/30",
  };
  return `px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border flex items-center gap-1 ${map[status] || map.stable}`;
};

const categoryColor = (cat) => {
  const map = { AI: "#a78bfa", DevOps: "#38bdf8", Frontend: "#f472b6", Backend: "#4ade80", Database: "#fb923c", Security: "#f43f5e", Testing: "#facc15", Other: "#94a3b8" };
  return map[cat] || "#94a3b8";
};

const RadarSection = ({ items, label, dotColor, ring }) => {
  if (!items?.length) return null;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-2.5 h-2.5 rounded-full border-2 ${ring}`} style={{ background: dotColor }} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{label}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t, i) => (
          <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/70">{t}</span>
        ))}
      </div>
    </div>
  );
};

export const AITechTrendCard = ({ techTrendData }) => {
  if (!techTrendData) return null;

  const {
    project_domain,
    trending_technologies = [],
    technology_radar = {},
    market_insights = [],
    trending_repos = [],
  } = techTrendData;

  const uniqueTechs = trending_technologies.filter(
    (t, i, self) => i === self.findIndex((x) => x.name === t.name)
  );

  const uniqueInsights = [...new Set(market_insights)];

  if (!uniqueTechs.length && !uniqueInsights.length) return null;

  return (
    <div className="glass-card p-6 flex flex-col gap-6 col-span-1 lg:col-span-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-neon-purple/10 border border-neon-purple/20">
            <Sparkles size={20} className="text-neon-purple" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white text-glow">Tech Trend Intelligence</h3>
            {project_domain && (
              <p className="text-xs text-text-muted mt-0.5">
                <span className="text-neon-purple font-medium">Domain: </span>{project_domain}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Trending Technologies */}
      {uniqueTechs.length > 0 && (
        <div>
          <p className="text-xs text-text-muted uppercase font-bold tracking-wider mb-3">Trending Technologies Relevant to Your Project</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {uniqueTechs.map((tech, i) => (
              <div key={i} className="bg-surface/50 border border-white/10 rounded-xl p-4 hover:bg-white/5 transition-all flex flex-col gap-2">
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: categoryColor(tech.category) }} />
                    <span className="text-base font-bold text-white">{tech.name}</span>
                  </div>
                  <span className={trendBadge(tech.trend_status)}>
                    {trendIcon(tech.trend_status)}
                    {tech.trend_status}
                  </span>
                </div>

                {/* Category */}
                <span className="text-xs px-2 py-0.5 rounded bg-white/5 border border-white/10 w-fit font-medium"
                  style={{ color: categoryColor(tech.category) }}>
                  {tech.category}
                </span>

                {/* Why trending */}
                {tech.why_trending && (
                  <p className="text-sm text-text-muted leading-relaxed mt-1">{tech.why_trending}</p>
                )}

                {/* Relevance */}
                {tech.relevance_to_project && (
                  <p className="text-sm text-white/70 italic mt-1 pb-1">{tech.relevance_to_project}</p>
                )}

                {/* Free tier */}
                {tech.free_tier && tech.free_tier_details && (
                  <div className="flex items-start gap-1.5 bg-neon-green/5 border border-neon-green/15 rounded-lg px-2 py-1.5">
                    <span className="text-neon-green text-[10px] font-bold uppercase tracking-wider flex-shrink-0 mt-0.5">FREE</span>
                    <span className="text-[11px] text-white/60">{tech.free_tier_details}</span>
                  </div>
                )}

                {/* Link */}
                {tech.url && (
                  <a
                    href={tech.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] text-neon-blue hover:text-white transition-colors mt-auto"
                  >
                    <Globe size={11} /> {tech.url.replace(/^https?:\/\//, "").split("/")[0]}
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Technology Radar + Market Insights side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Radar */}
        {Object.values(technology_radar).some((v) => v?.length > 0) && (
          <div>
            <p className="text-xs text-text-muted uppercase font-bold tracking-wider mb-4">Technology Radar</p>
            <div className="space-y-4">
              <RadarSection items={technology_radar.adopt}  label="Adopt"  dotColor="#4ade80" ring="border-neon-green/50" />
              <RadarSection items={technology_radar.trial}  label="Trial"  dotColor="#38bdf8" ring="border-neon-blue/50" />
              <RadarSection items={technology_radar.assess} label="Assess" dotColor="#a78bfa" ring="border-neon-purple/50" />
              <RadarSection items={technology_radar.hold}   label="Hold"   dotColor="#f472b6" ring="border-neon-pink/50" />
            </div>
          </div>
        )}

        {/* Market insights */}
        {uniqueInsights.length > 0 && (
          <div>
            <p className="text-xs text-text-muted uppercase font-bold tracking-wider mb-4">Market Insights</p>
            <ul className="space-y-3">
              {uniqueInsights.map((ins, i) => (
                <li key={i} className="flex items-start gap-2 bg-surface/30 border border-white/10 rounded-lg p-3">
                  <Sparkles size={13} className="text-neon-purple mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-white/80 leading-relaxed">{ins}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Trending Repos */}
      {trending_repos.length > 0 && (
        <div>
          <p className="text-xs text-text-muted uppercase font-bold tracking-wider mb-3">Trending Repos to Watch</p>
          <div className="flex flex-wrap gap-3">
            {trending_repos.filter((r, i, s) => i === s.findIndex((x) => x.name === r.name)).map((repo, i) => (
              <a
                key={i}
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-surface/50 border border-white/10 rounded-xl px-4 py-2.5 hover:bg-white/10 hover:border-neon-purple/30 transition-all group"
              >
                <GitBranch size={13} className="text-neon-purple" />
                <div>
                  <p className="text-xs font-semibold text-white group-hover:text-neon-purple transition-colors">{repo.name}</p>
                  {repo.why_relevant && <p className="text-[10px] text-text-muted">{repo.why_relevant}</p>}
                </div>
                <ExternalLink size={11} className="text-white/30 group-hover:text-neon-purple ml-1 transition-colors" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AITechTrendCard;
