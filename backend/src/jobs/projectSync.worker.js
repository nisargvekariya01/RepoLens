const { Worker } = require("bullmq");
const { ObjectId } = require("mongodb");
const connection = require("../config/redis");
const { getDb } = require("../config/db");
const githubService = require("../services/github.service");
const localGitService = require("../services/localGit.service");
const scoringService = require("../services/scoring.service");
const recommendationService = require("../services/recommendation.service");
const alertService = require("../services/alert.service");
const { addAiJob } = require("./aiAnalysis.queue");
const { getDaysAgo } = require("../utils/date.utils");

const worker = connection
  ? new Worker(
      "project-sync",
      async (job) => {
        const { projectId } = job.data;
        console.log(`🎬 Starting job ${job.id} for project ${projectId}`);

        try {
          const db = getDb();

          // 1. Fetch Project & Latest Previous Snapshot
          const project = await db.collection("projects").findOne({ _id: new ObjectId(projectId) });
          if (!project) {
            console.log(`[SYNC] Project not found (deleted). Aborting job ${job.id}`);
            await db.collection("jobs").updateOne(
              { bullmq_id: job.id },
              { $set: { status: "failed", error: "Project deleted", completed_at: new Date() } }
            );
            return;
          }

          const prevSnapshot = await db.collection("project_snapshots")
            .find({ project_id: new ObjectId(projectId) })
            .sort({ snapshot_date: -1 })
            .limit(1)
            .next();

          // 2. Fetch User Token
          const user = await db.collection("users").findOne({ _id: new ObjectId(project.user_id) });
          const userGithubToken = user?.github_access_token || null;

          const { repo_owner, repo_name } = project;
          const sinceDate = getDaysAgo(30);
          const forceRefresh = job.data.forceRefresh || false;

          // 3. Parallel Sync & Interception
          let repoMeta, commitCount, issueStats, prStats, contributorCount;

          try {
            if (project.local_path) {
              // LOCAL PATH BYPASS
              [repoMeta, commitCount, issueStats, prStats, contributorCount] = await Promise.all([
                localGitService.getRepoMeta(project.local_path),
                localGitService.getCommitCount(project.local_path, sinceDate),
                localGitService.getIssueStats(project.local_path),
                localGitService.getPRStats(project.local_path),
                localGitService.getContributorCount(project.local_path),
              ]);
            } else {
              // EXPLICIT GITHUB PROXIED CACHING
              [repoMeta, commitCount, issueStats, prStats, contributorCount] = await Promise.all([
                githubService.getRepoMeta(repo_owner, repo_name, userGithubToken, forceRefresh),
                githubService.getCommitCount(repo_owner, repo_name, userGithubToken, sinceDate, forceRefresh),
                githubService.getIssueStats(repo_owner, repo_name, userGithubToken, forceRefresh),
                githubService.getPRStats(repo_owner, repo_name, userGithubToken, forceRefresh),
                githubService.getContributorCount(repo_owner, repo_name, userGithubToken, forceRefresh),
              ]);
            }
          } catch (e) {
            // OFFLINE SNAPSHOT FALLBACK
            if (e.isOffline && prevSnapshot) {
              console.warn(`[SYNC] Network Offline / Rate Limited: Initiating emergency hydration utilizing snapshot for ${repo_name}`);
              repoMeta = prevSnapshot.repo_meta;
              commitCount = prevSnapshot.commit_count;
              issueStats = prevSnapshot.issue_stats;
              prStats = prevSnapshot.pr_stats;
              contributorCount = prevSnapshot.contributor_count;
            } else {
              throw e;
            }
          }

          // 4. Calculate Score
          const scoreData = {
            commit_count: commitCount || 0,
            open_issues: issueStats?.open_count || 0,
            closed_issues: issueStats?.closed_count || 0,
            stale_count: issueStats?.stale_count || 0,
            open_prs: prStats?.open_count || 0,
            merged_prs: prStats?.merged_count || 0,
            contributors: contributorCount || 0,
          };
          const healthScore = scoringService.calculateHealthScore(scoreData);

          // 5. Create Snapshot
          const snapshot = {
            project_id: new ObjectId(projectId),
            snapshot_date: new Date(),
            repo_meta: repoMeta,
            commit_count: commitCount,
            issue_stats: issueStats,
            pr_stats: prStats,
            contributor_count: contributorCount,
            health_score: healthScore,
            created_at: new Date(),
          };
          const result = await db.collection("project_snapshots").insertOne(snapshot);
          const snapshotId = result.insertedId;

          // 6. Recommendations
          const recommendations = recommendationService.generateRecommendations(scoreData, healthScore);
          const recommendationsToSave = recommendations.map((rec) => ({
            ...rec,
            project_id: new ObjectId(projectId),
            snapshot_id: snapshotId,
            created_at: new Date(),
          }));

          if (recommendationsToSave.length > 0) {
            await db.collection("recommendations").insertMany(recommendationsToSave);
          }

          // 7. Check and Create Alerts
          await alertService.checkAndCreateAlerts(projectId, healthScore, prevSnapshot, scoreData);

          // 8. Auto-trigger AI Analysis Job
          const aiJob = await addAiJob(projectId);
          if (aiJob && !aiJob.isDuplicate) {
            await db.collection("jobs").insertOne({
              bullmq_id: aiJob.id,
              project_id: new ObjectId(projectId),
              type: "ai_analysis",
              status: "pending",
              created_at: new Date(),
            });
          }

          // 9. Success - Update job status in DB
          await db.collection("jobs").updateOne(
            { bullmq_id: job.id },
            { $set: { status: "completed", completed_at: new Date() } }
          );

          // 10. Update last_updated_at tracker on main project record for fast frontend retrieval
          await db.collection("projects").updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { last_updated_at: new Date() } }
          );

          console.log(`✅ Job ${job.id} success for project ${repo_name}`);
        } catch (error) {
          console.error(`❌ Job ${job.id} failed:`, error.message);
          
          const db = getDb();
          await db.collection("jobs").updateOne(
            { bullmq_id: job.id },
            { $set: { status: "failed", error: error.message, completed_at: new Date() } }
          );

          throw error; // Let BullMQ handle retries
        }
      },
      { connection }
    )
  : null;

module.exports = worker;
