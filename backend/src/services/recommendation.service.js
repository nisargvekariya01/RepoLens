/**
 * Generate actionable recommendations based on health scores.
 */
function generateRecommendations(snapshotData, scores) {
  const recommendations = [];
  const { breakdown } = scores;
  const { contributors, stale_count, open_issues } = snapshotData;

  // 1. Commit Activity
  if (breakdown.commitActivity < 50) {
    recommendations.push({
      type: "activity",
      message: "No commits in 30 days. Project may be stalled.",
      severity: "high",
    });
  } else if (breakdown.commitActivity < 80) {
    recommendations.push({
      type: "activity",
      message: "Low commit frequency. Consider setting a more regular release schedule.",
      severity: "medium",
    });
  }

  // 2. Issue Backlog / Stale Ratio
  if (breakdown.staleRatio < 50) {
    recommendations.push({
      type: "maintenance",
      message: `Over half of open issues (${stale_count}) are stale (>30 days). Consider an issue triage session.`,
      severity: "high",
    });
  } else if (breakdown.issueBacklog < 50) {
    recommendations.push({
      type: "maintenance",
      message: `Large issue backlog (${open_issues} open issues). Community support might be needed for triaging.`,
      severity: "medium",
    });
  }

  // 3. Maintainability (Bus Factor)
  if (contributors === 1) {
    recommendations.push({
      type: "risk",
      message: "Only one contributor. Bus factor risk. Encourage more maintainers.",
      severity: "high",
    });
  } else if (contributors <= 3) {
    recommendations.push({
      type: "risk",
      message: "Small team of contributors. Consider recruiting more reviewers.",
      severity: "medium",
    });
  }

  // 4. Progress Momentum
  if (breakdown.progressMomentum < 40) {
    recommendations.push({
      type: "momentum",
      message: "High ratio of open PRs compared to merged. PR review process might be a bottleneck.",
      severity: "medium",
    });
  }

  return recommendations.slice(0, 5); // Return max 5 as requested
}

module.exports = {
  generateRecommendations,
};
