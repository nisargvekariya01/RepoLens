/**
 * Calculate health score based on GitHub snapshot metrics.
 */
function calculateHealthScore(data) {
  const {
    commit_count = 0,
    open_issues = 0,
    closed_issues = 0,
    stale_count = 0,
    open_prs = 0,
    merged_prs = 0,
    contributors = 0,
  } = data;

  // 1. Commit Activity (20%)
  let commitActivity = 0;
  if (commit_count === 0) commitActivity = 0;
  else if (commit_count <= 5) commitActivity = 40;
  else if (commit_count <= 15) commitActivity = 70;
  else if (commit_count <= 30) commitActivity = 90;
  else commitActivity = 100;

  // 2. Issue Backlog (20%)
  let issueBacklog = 0;
  if (open_issues === 0) issueBacklog = 100;
  else if (open_issues <= 5) issueBacklog = 90;
  else if (open_issues <= 15) issueBacklog = 70;
  else if (open_issues <= 30) issueBacklog = 50;
  else if (open_issues <= 50) issueBacklog = 30;
  else issueBacklog = 10;

  // 3. Stale Ratio (20%)
  const ratio = (stale_count / (open_issues + 1)) * 100;
  let staleRatio = 0;
  if (ratio === 0) staleRatio = 100;
  else if (ratio < 10) staleRatio = 80;
  else if (ratio < 25) staleRatio = 60;
  else if (ratio < 50) staleRatio = 40;
  else staleRatio = 20;

  // 4. Progress Momentum (20%)
  const progressMomentum = Math.min(((merged_prs / (open_prs + merged_prs + 1)) * 100), 100);

  // 5. Maintainability (20%)
  let maintainability = 0;
  if (contributors <= 1) maintainability = 40;
  else if (contributors <= 3) maintainability = 70;
  else if (contributors <= 6) maintainability = 90;
  else maintainability = 100;

  // Weighted Total
  const overall = (
    commitActivity * 0.2 +
    issueBacklog * 0.2 +
    staleRatio * 0.2 +
    progressMomentum * 0.2 +
    maintainability * 0.2
  ).toFixed(1);

  // Labeling
  let label = "Critical";
  const scoreNum = parseFloat(overall);
  if (scoreNum >= 75) label = "Healthy";
  else if (scoreNum >= 50) label = "Fair";
  else if (scoreNum >= 25) label = "At Risk";

  return {
    overall: parseFloat(overall),
    breakdown: {
      commitActivity,
      issueBacklog,
      staleRatio,
      progressMomentum: parseFloat(progressMomentum.toFixed(1)),
      maintainability,
    },
    label,
  };
}

module.exports = {
  calculateHealthScore,
};
