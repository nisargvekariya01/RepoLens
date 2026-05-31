const { ObjectId } = require("mongodb");
const { getDb } = require("../config/db");

/**
 * Checks for regressions, critical health, and inactivity.
 * Creates alerts in the database if conditions are met.
 */
async function checkAndCreateAlerts(projectId, scores, previousSnapshot, currentData) {
  const db = getDb();
  const alerts = [];

  // 1. Regression Alert (>15 points drop)
  if (previousSnapshot && previousSnapshot.health_score) {
    const previousScore = previousSnapshot.health_score.overall;
    const currentScore = scores.overall;
    const drop = previousScore - currentScore;

    if (drop > 15) {
      alerts.push({
        project_id: new ObjectId(projectId),
        type: "regression",
        message: `Health score dropped by ${drop.toFixed(1)} points (from ${previousScore} to ${currentScore}).`,
        severity: "high",
        is_read: false,
        created_at: new Date(),
      });
    }
  }

  // 2. Critical Health Alert (<25)
  if (scores.overall < 25) {
    alerts.push({
      project_id: new ObjectId(projectId),
      type: "critical",
      message: `Project is in critical health status (Score: ${scores.overall}).`,
      severity: "high",
      is_read: false,
      created_at: new Date(),
    });
  }

  // 3. Inactivity Alert (0 commits in 30 days)
  if (!currentData.commit_count || currentData.commit_count === 0) {
    alerts.push({
      project_id: new ObjectId(projectId),
      type: "inactivity",
      message: "No commits detected in the last 30 days. Project may be stalling.",
      severity: "medium",
      is_read: false,
      created_at: new Date(),
    });
  }

  // Save alerts to DB
  if (alerts.length > 0) {
    await db.collection("alerts").insertMany(alerts);
    console.log(`🔔 Created ${alerts.length} alerts for project ${projectId}`);
  }

  return alerts;
}

module.exports = {
  checkAndCreateAlerts,
};
