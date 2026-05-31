/**
 * Helper to safely calculate percentage growth.
 */
function calculateGrowth(current, past) {
  if (past === 0) {
    return current > 0 ? 100 : 0;
  }
  const growth = ((current - past) / past) * 100;
  return Number(growth.toFixed(2));
}

/**
 * Normalizes a number into a 0-100 scale using a sensible ceiling logic 
 * preventing excessive outlier skewing on high metrics.
 */
function normalizeScore(value, ceiling) {
  if (value >= ceiling) return 100;
  if (value <= 0) return 0;
  return Number(((value / ceiling) * 100).toFixed(2));
}

/**
 * Calculates trends and activity score based on metrics delta.
 * @param {Object} currentMetrics e.g. { stars, forks, commitsCount, closedIssues }
 * @param {Object} pastMetrics e.g. { stars, forks, commitsCount, closedIssues }
 */
function calculateMetricsTrends(currentMetrics, pastMetrics) {
  // Prevent strict undefined errors by falling back safely to 0
  const currStars = currentMetrics?.stars || 0;
  const pastStars = pastMetrics?.stars || 0;
  
  const currForks = currentMetrics?.forks || 0;
  const pastForks = pastMetrics?.forks || 0;

  const currCommits = currentMetrics?.commitsCount || 0;
  const pastCommits = pastMetrics?.commitsCount || 0;

  const starsGrowth = calculateGrowth(currStars, pastStars);
  const forksGrowth = calculateGrowth(currForks, pastForks);

  // Commits trend evaluation
  let commitTrend = "stable";
  if (currCommits > pastCommits * 1.05) {
    commitTrend = "up";
  } else if (currCommits < pastCommits * 0.95) {
    commitTrend = "down";
  }

  // Activity Score Formula (0-100)
  // Commits in last 30 days are weighed heavily, mapping to a ceiling logically.
  // Example Ceiling logic: 100 commits a month is top-tier (100 pts)
  // Forks & Stars growth gives bonus points but baseline is volume interaction.
  const commitsScore = normalizeScore(currCommits, 100); 
  const issueClosureScore = normalizeScore(currentMetrics?.issues?.closed || 0, 50); // e.g., 50 issues closed a month
  
  let rawActivityScore = (commitsScore * 0.70) + (issueClosureScore * 0.30);
  
  // Growth bonuses
  if (starsGrowth > 5) rawActivityScore += 5;
  if (forksGrowth > 5) rawActivityScore += 5;
  if (commitTrend === "up") rawActivityScore += 10;
  if (commitTrend === "down") rawActivityScore -= 10;

  // Clamp safely between 0 and 100
  const activityScore = Math.max(0, Math.min(100, Math.round(rawActivityScore)));

  return {
    starsGrowth,
    forksGrowth,
    commitTrend,
    activityScore
  };
}

module.exports = {
  calculateMetricsTrends,
  calculateGrowth,
  normalizeScore
};
