const { Queue } = require("bullmq");
const connection = require("../config/redis");

// ─── Job Type Constants ───────────────────────────────────────────────────────
const JOB_TYPES = {
  ANALYZE_REPO: "ANALYZE_REPO",
  ANALYZE_FILE: "ANALYZE_FILE",
  AGGREGATE_RESULTS: "AGGREGATE_RESULTS",
  GENERATE_REPORT: "GENERATE_REPORT",
  REPOMIX_ANALYZE: "REPOMIX_ANALYZE",      // Repomix-mode: local repo pack + chunk + summarize
  REPOMIX_GENERATE_REPORT: "REPOMIX_GENERATE_REPORT" // Repomix-mode: aggregate + enrich report
};

// ─── Queue Definition ─────────────────────────────────────────────────────────
const aiQueue = connection
  ? new Queue("ai-analysis", {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 50,
        removeOnFail: 30,
        timeout: 300000 // 5 minutes hard limit
      }
    })
  : null;

const { ObjectId } = require("mongodb");
const { getDb } = require("../config/db");

async function findActiveJob(projectId) {
  try {
    const db = getDb();
    if (!db) return null;
    return await db.collection("jobs").findOne({
      project_id: new ObjectId(projectId),
      type: { $in: ["ai_analysis", "ai_analysis_repomix", "ai_analysis_github_rag", "ANALYZE_REPO", "REPOMIX_ANALYZE"] },
      status: { $in: ["pending", "queued", "active", "processing"] }
    });
  } catch (e) {
    return null; // safe fallback
  }
}

/**
 * Add the initial ANALYZE_REPO job to kick off a full pipeline run.
 */
async function addAiJob(projectId, reportId) {
  if (!aiQueue) {
    console.error("[AI Queue] Queue not initialized — Redis down?");
    return null;
  }

  const existingJob = await findActiveJob(projectId);
  if (existingJob) {
    console.log(`[AI Queue] Duplicate prevented for project ${projectId}`);
    existingJob.id = existingJob.bullmq_id;
    existingJob.isDuplicate = true;
    return existingJob;
  }

  const job = await aiQueue.add(
    JOB_TYPES.ANALYZE_REPO,
    { projectId, reportId },
    { priority: 1 }
  );
  console.log(`[AI Queue] ANALYZE_REPO queued — job ${job.id} for project ${projectId}`);
  return job;
}

/**
 * Add a single ANALYZE_FILE job (called internally by the worker).
 */
async function addFileAnalysisJob(projectId, reportId, filePath, priority = 2) {
  if (!aiQueue) return null;
  return aiQueue.add(
    JOB_TYPES.ANALYZE_FILE,
    { projectId, reportId, filePath },
    { priority }
  );
}

/**
 * Add the AGGREGATE_RESULTS job (called after all file jobs complete).
 */
async function addAggregateJob(projectId, reportId) {
  if (!aiQueue) return null;
  return aiQueue.add(
    JOB_TYPES.AGGREGATE_RESULTS,
    { projectId, reportId },
    { priority: 3, delay: 2000 } // slight delay to let file jobs settle
  );
}

/**
 * Add the GENERATE_REPORT job (called after aggregation).
 */
async function addGenerateReportJob(projectId, reportId) {
  if (!aiQueue) return null;
  return aiQueue.add(
    JOB_TYPES.GENERATE_REPORT,
    { projectId, reportId },
    { priority: 4 }
  );
}

/**
 * Add a REPOMIX_ANALYZE job — kicks off the Repomix-mode pipeline.
 * Requires the project to have a `local_path` field set in MongoDB.
 */
async function addRepomixJob(projectId, reportId) {
  if (!aiQueue) {
    console.error("[AI Queue] Queue not initialized — Redis down?");
    return null;
  }

  const existingJob = await findActiveJob(projectId);
  if (existingJob) {
    console.log(`[AI Queue] Duplicate prevented for project ${projectId} (Repomix)`);
    existingJob.id = existingJob.bullmq_id;
    existingJob.isDuplicate = true;
    return existingJob;
  }

  const job = await aiQueue.add(
    JOB_TYPES.REPOMIX_ANALYZE,
    { projectId, reportId, useRepomix: true },
    { priority: 1 }
  );
  console.log(`[AI Queue] REPOMIX_ANALYZE queued — job ${job.id} for project ${projectId}`);
  return job;
}

/**
 * Add the REPOMIX_GENERATE_REPORT job (called by Repomix worker after analysis).
 */
async function addRepomixGenerateReportJob(projectId, reportId, repomixSummary) {
  if (!aiQueue) return null;
  return aiQueue.add(
    JOB_TYPES.REPOMIX_GENERATE_REPORT,
    { projectId, reportId, useRepomix: true, repomixSummary },
    { priority: 4 }
  );
}


async function resumeIncompleteJobs() {
  if (!aiQueue) return;
  
  // Slight delay locally to ensure DB connection solidifies if needed
  setTimeout(async () => {
    try {
      const db = getDb();
      const incompleteJobs = await db.collection("jobs")
        .find({
          type: { $in: ["ai_analysis_repomix", "ai_analysis_github_rag", "ai_analysis"] },
          status: { $in: ["active", "processing"] }
        }).toArray();

      for (const job of incompleteJobs) {
        console.log(`[AI Queue] Auto-resuming incomplete job ${job._id} (was ${job.status})`);
        
        await db.collection("jobs").updateOne(
          { _id: job._id },
          { $set: { status: "queued", progress: 0, message: "Auto-resumed after reboot" } }
        );
        
        if (job.report_id) {
           await db.collection("ai_reports").updateOne(
            { _id: job.report_id },
            { $set: { status: "queued", progress: 0, message: "Auto-resumed after reboot" } }
          );
        }

        if (job.type === "ai_analysis_repomix") {
          await addRepomixJob(job.project_id.toString(), job.report_id?.toString());
        } else {
          await addAiJob(job.project_id.toString(), job.report_id?.toString());
        }
      }
    } catch (e) {
      console.error("[AI Queue] Failed to resume incomplete jobs:", e.message);
    }
  }, 2000);
}

module.exports = {
  aiQueue,
  JOB_TYPES,
  addAiJob,
  addFileAnalysisJob,
  addAggregateJob,
  addGenerateReportJob,
  addRepomixJob,
  addRepomixGenerateReportJob,
  resumeIncompleteJobs
};
