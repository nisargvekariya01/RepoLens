const express = require("express");
const { ObjectId } = require("mongodb");
const { getDb } = require("../config/db");
const githubService = require("../services/github.service");
const scoringService = require("../services/scoring.service");
const recommendationService = require("../services/recommendation.service");
const authMiddleware = require("../middleware/auth.middleware");
const { getDaysAgo } = require("../utils/date.utils");
const { addSyncJob, setAutoSync } = require("../jobs/projectSync.queue");
const { safeDecryptToken } = require("../utils/tokenEncryption");
const { checkAndIncrementAnalysisLimit } = require("../utils/subscriptionLimits");

function resolveTokenFromUser(user) {
  if (user?.github?.access_token_encrypted) {
    const dec = safeDecryptToken(user.github.access_token_encrypted);
    if (dec) return dec;
  }
  return user?.github_access_token || null;
}


const router = express.Router();

/**
 * @route POST /api/projects/:id/sync
 * @desc  Fetch latest GitHub data and save a snapshot
 */
router.post("/:id/sync", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    await checkAndIncrementAnalysisLimit(userId, req.user.email);
    const db = getDb();

    // 1. Fetch Project & Verify Ownership
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(id),
      user_id: new ObjectId(userId),
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found or unauthorized." });
    }

    // 2. Fetch User for GitHub token
    const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });
    const userGithubToken = resolveTokenFromUser(user);


    const { repo_owner, repo_name } = project;
    const sinceDate = getDaysAgo(30);

    // 3. Parallel API Calls to GitHub
    console.log(`📡 Syncing ${repo_owner}/${repo_name}...`);
    const [
      repoMeta,
      commitCount,
      issueStats,
      prStats,
      contributorCount
    ] = await Promise.all([
      githubService.getRepoMeta(repo_owner, repo_name, userGithubToken),
      githubService.getCommitCount(repo_owner, repo_name, userGithubToken, sinceDate),
      githubService.getIssueStats(repo_owner, repo_name, userGithubToken),
      githubService.getPRStats(repo_owner, repo_name, userGithubToken),
      githubService.getContributorCount(repo_owner, repo_name, userGithubToken)
    ]);

    // 4. Calculate Health Score
    const scoreData = {
      commit_count: commitCount,
      open_issues: issueStats.open_count,
      closed_issues: issueStats.closed_count,
      stale_count: issueStats.stale_count,
      open_prs: prStats.open_count,
      merged_prs: prStats.merged_count,
      contributors: contributorCount,
    };

    const healthScore = scoringService.calculateHealthScore(scoreData);

    // 5. Create Snapshot Object with Score
    const snapshot = {
      project_id: new ObjectId(id),
      snapshot_date: new Date(),
      repo_meta: repoMeta,
      commit_count: commitCount,
      issue_stats: issueStats,
      pr_stats: prStats,
      contributor_count: contributorCount,
      health_score: healthScore,
      created_at: new Date(),
    };

    // 6. Save Snapshot to DB
    const result = await db.collection("project_snapshots").insertOne(snapshot);
    const snapshotId = result.insertedId;

    // 7. Generate and Save Recommendations
    const recommendations = recommendationService.generateRecommendations(scoreData, healthScore);
    const recommendationsToSave = recommendations.map(rec => ({
      ...rec,
      project_id: new ObjectId(id),
      snapshot_id: snapshotId,
      created_at: new Date()
    }));

    if (recommendationsToSave.length > 0) {
      await db.collection("recommendations").insertMany(recommendationsToSave);
    }
    
    res.status(201).json({
      id: snapshotId,
      ...snapshot,
      recommendations: recommendationsToSave
    });

    console.log(`✅ Sync complete for project: ${repo_name}`);
  } catch (error) {
    console.error("Sync error:", error.message);
    return res.status(error.statusCode || 500).json({ error: error.statusCode === 429 ? error.message : "Failed to synchronize GitHub data." });
  }
});

/**
 * @route POST /api/projects/:id/sync/queue
 * @desc  Queue a background GitHub sync job
 */
router.post("/:id/sync/queue", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    await checkAndIncrementAnalysisLimit(userId, req.user.email);
    const db = getDb();

    // 1. Verify Project Ownership
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(id),
      user_id: new ObjectId(userId),
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found or unauthorized." });
    }

    // 2. Add to Queue
    const job = await addSyncJob(id);
    if (!job) {
      return res.status(500).json({ error: "Failed to queue sync job." });
    }

    // 3. Log Job in Jobs Table
    const dbJob = {
      project_id: new ObjectId(id),
      bullmq_id: job.id,
      type: "sync",
      status: "pending",
      created_at: new Date(),
    };
    await db.collection("jobs").insertOne(dbJob);

    res.status(202).json({
      message: "Sync job queued",
      jobId: job.id,
    });
  } catch (error) {
    console.error("Queue error:", error.message);
    return res.status(error.statusCode || 500).json({ error: error.statusCode === 429 ? error.message : "Internal server error while queueing job." });
  }
});

/**
 * @route GET /api/projects/:id/jobs
 * @desc  Fetch recent job history for a project
 */
router.get("/:id/jobs", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const db = getDb();

    // Verify Project Ownership
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(id),
      user_id: new ObjectId(userId),
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found or unauthorized." });
    }

    // Disable caching for polling
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.set("ETag", "");

    // Fetch Last 10 Jobs
    const jobs = await db
      .collection("jobs")
      .find({ project_id: new ObjectId(id) })
      .sort({ created_at: -1 })
      .limit(10)
      .toArray();

    res.status(200).json(jobs);
  } catch (error) {
    console.error("Fetch jobs error:", error.message);
    res.status(500).json({ error: "Internal server error while fetching jobs." });
  }
});

/**
 * @route POST /api/projects/:id/sync/auto-refresh
 * @desc  Configure automated interval updates utilizing Redis Cron 
 */
router.post("/:id/sync/auto-refresh", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { hours } = req.body;
  const userId = req.user.id;

  try {
    const db = getDb();
    
    // Validate Ownership
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(id),
      user_id: new ObjectId(userId),
    });

    if (!project) return res.status(404).json({ error: "Project not found." });

    // Establish BullMQ Redis Interval Cycle
    await setAutoSync(id, parseInt(hours) || 0);

    // Save Preference Record
    await db.collection("projects").updateOne(
      { _id: new ObjectId(id) },
      { $set: { auto_refresh_hours: parseInt(hours) || 0 } }
    );

    res.status(200).json({ message: "Auto-refresh settings applied.", hours: parseInt(hours) || 0 });
  } catch (error) {
    console.error("Auto-Refresh error:", error.message);
    res.status(500).json({ error: "Failed to configure auto-refresh schedule." });
  }
});

module.exports = router;
