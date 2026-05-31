const HealthScoreCard = ({ breakdown }) => {
  if (!breakdown) return null;

  const metrics = [
    { key: 'commitActivity', label: 'Commit Activity' },
    { key: 'issueBacklog', label: 'Issue Backlog' },
    { key: 'staleRatio', label: 'Stale Ratio' },
    { key: 'progressMomentum', label: 'PR Momentum' },
    { key: 'maintainability', label: 'Maintainability' },
  ];

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-semibold mb-4 text-white">Health Breakdown</h3>
      <div className="space-y-4">
        {metrics.map(({ key, label }) => {
          const score = breakdown[key] || 0;
          return (
            <div key={key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-text-muted">{label}</span>
                <span className="font-bold text-white transition-all duration-300">{score}/100</span>
              </div>
              <div className="w-full bg-surface-hover rounded-full h-2.5 overflow-hidden">
                <div 
                  className={`h-2.5 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_currentColor] ${score < 50 ? 'bg-neon-pink text-neon-pink' : score < 75 ? 'bg-yellow-500 text-yellow-500' : 'bg-neon-green text-neon-green'}`} 
                  style={{ width: `${Math.max(score, 2)}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HealthScoreCard;
