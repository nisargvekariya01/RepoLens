const { ObjectId } = require("mongodb");
const { getDb } = require("../config/db");
const { generateFullAIReport } = require("../services/aiAnalysis.service");
const { addAiJob, addRepomixJob } = require("../jobs/aiAnalysis.queue");
const githubService = require("../services/github.service");
const { checkAndIncrementAnalysisLimit } = require("../utils/subscriptionLimits");

/**
 * Common data fetcher for AI analysis.
 */
async function fetchProjectData(projectId, userId) {
  const db = getDb();
  const project = await db.collection("projects").findOne({ 
    _id: new ObjectId(projectId), 
    user_id: new ObjectId(userId) 
  });

  if (!project) return null;

  const allSnapshots = await db.collection("project_snapshots")
    .find({ project_id: new ObjectId(projectId) })
    .sort({ snapshot_date: -1 })
    .limit(10)
    .toArray();

  const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });
  const userGithubToken = user?.github_access_token || null;
  
  const issues = await githubService.getRecentIssues(project.repo_owner, project.repo_name, userGithubToken);
  const commits = await githubService.getRecentCommits(project.repo_owner, project.repo_name, userGithubToken);

  return { project, latestSnapshot: allSnapshots[0], allSnapshots, issues, commits };
}

/**
 * GET /api/projects/:id/ai/report
 */
async function getLatestReport(req, res) {
  try {
    const db = getDb();
    const projectId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.user.id);

    const project = await db.collection("projects").findOne({ _id: projectId, user_id: userId });
    if (!project) return res.status(404).json({ error: "Project not found" });

    // Disable caching for polling
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.set("ETag", "");

    const report = await db.collection("ai_reports")
      .find({ project_id: projectId })
      .sort({ created_at: -1 })
      .limit(1)
      .next();

    // No report at all — check if a job is running so frontend knows state
    if (!report) {
      const activeJob = await db.collection("jobs").findOne({
        project_id: projectId,
        type: { $in: ["ai_analysis", "ai_analysis_repomix", "ai_analysis_github_rag"] },
        status: { $in: ["pending", "queued", "running", "active", "processing"] }
      });
      if (activeJob) {
        return res.status(200).json({
          status: "processing",
          ready: false,
          progress: activeJob.progress || 0,
          message: activeJob.message || "Analysis in progress..."
        });
      }
      // Truly no report and no active job
      return res.status(200).json({ status: "idle", ready: false });
    }

    // Report exists — check its status
    if (report.status === "completed" && report.generated_at) {
      // Job-report consistency: if completed flag but core data is missing, mark failed
      if (!report.issues_data && !report.risk_data) {
        await db.collection("ai_reports").updateOne(
          { _id: report._id },
          { $set: { status: "failed", error: "Report completed but data is missing" } }
        );
        await db.collection("jobs").updateMany(
          { report_id: report._id },
          { $set: { status: "failed", message: "Report data missing after completion" } }
        );
        return res.status(200).json({
          status: "failed",
          ready: false,
          error: "Report completed but data is missing. Please re-run analysis."
        });
      }
      return res.status(200).json({
        status: "completed",
        ready: true,
        data: report
      });
    }

    if (report.status === "failed") {
      return res.status(200).json({
        status: "failed",
        ready: false,
        error: report.error || "Analysis failed. Please re-run."
      });
    }

    // Still processing (queued / active / processing)
    return res.status(200).json({
      status: "processing",
      ready: false,
      progress: report.progress || 0,
      message: report.message || "Analysis in progress..."
    });
  } catch (error) {
    console.error("Error fetching latest AI report:", error);
    res.status(500).json({ error: "Failed to fetch report" });
  }
}

/**
 * GET /api/projects/:id/ai/reports
 */
async function getReportHistory(req, res) {
  try {
    const db = getDb();
    const projectId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.user.id);

    const project = await db.collection("projects").findOne({ _id: projectId, user_id: userId });
    if (!project) return res.status(404).json({ error: "Project not found" });

    const reports = await db.collection("ai_reports")
      .find({ project_id: projectId })
      .sort({ generated_at: -1 })
      .limit(5)
      .project({ 
        _id: 1, 
        generated_at: 1, 
        "risk_data.risk_level": 1, 
        "trend_data.trend_direction": 1 
      })
      .toArray();

    const formatted = reports.map(r => ({
      id: r._id,
      generated_at: r.generated_at,
      risk_level: r.risk_data?.risk_level,
      trend_direction: r.trend_data?.trend_direction
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Error fetching AI report history:", error);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
}

/**
 * POST /api/projects/:id/ai/analyze
 * Synchronous slow route (up to 60s)
 */
async function runFullAnalysis(req, res) {
  // Set response timeout to 60s
  req.setTimeout(60000);

  try {
    await checkAndIncrementAnalysisLimit(req.user.id, req.user.email);
    const data = await fetchProjectData(req.params.id, req.user.id);
    if (!data) return res.status(404).json({ error: "Project not found" });

    const { project, latestSnapshot, allSnapshots, issues, commits } = data;

    if (!latestSnapshot) {
      return res.status(400).json({ error: "Run a sync first before AI analysis" });
    }

    const report = await generateFullAIReport(project, latestSnapshot, allSnapshots, issues, commits);

    const db = getDb();
    const result = await db.collection("ai_reports").insertOne({
      project_id:        new ObjectId(project._id),
      snapshot_id:       new ObjectId(latestSnapshot._id),
      status:            "completed",
      code_quality_score: report.code_quality_score ?? null,
      issues_data:       report.issues_data,
      trend_data:        report.trend_data,
      tech_trend_data:   report.tech_trend_data,
      future_score_data: report.future_score_data,
      suggestions_data:  report.suggestions_data,
      risk_data:         report.risk_data,
      generated_at:      new Date()
    });

    report.id = result.insertedId;
    res.json(report);
  } catch (error) {
    console.error("Error running AI analysis:", error);
    return res.status(error.statusCode || 500).json({ error: error.statusCode === 429 ? error.message : "Failed to run AI analysis" });
  }
}

async function getReport(projectId) {
  const db = getDb();
  return await db.collection("ai_reports")
    .find({ project_id: new ObjectId(projectId) })
    .sort({ created_at: -1 })
    .limit(1)
    .next();
}

async function clearPreviousJobState(db, projectId) {
  // Hard delete previous jobs so they don't trigger the uniqueness constraint
  await db.collection("jobs").deleteMany({
    project_id: projectId,
    type: { $in: ["ai_analysis", "ai_analysis_repomix", "ai_analysis_github_rag", "ANALYZE_REPO", "REPOMIX_ANALYZE"] }
  });
  // Clear any hung or completed reports if needed conceptually, but getting a fresh slate on Jobs is the strict requirement
  // to ensure a new Queue task executes. We can also optionally delete/reset ai_reports here, but updating/ignoring is fine.
}

/**
 * POST /api/projects/:id/ai/analyze/queue
 * Auto-selects the pipeline based on project.local_path:
 *   - local_path set  → Repomix mode (no GitHub API batching, no Qdrant)
 *   - no local_path   → GitHub API + Qdrant RAG mode (original behavior)
 */
async function runAnalysisAsJob(req, res) {
  try {
    await checkAndIncrementAnalysisLimit(req.user.id, req.user.email);
    const db = getDb();
    const projectId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.user.id);

    const project = await db.collection("projects").findOne({ _id: projectId, user_id: userId });
    if (!project) return res.status(404).json({ error: "Project not found" });

    const existingReport = await getReport(projectId);
    const force = req.body?.force === true;

    if (force) {
      console.log(`[AI] Re-run requested stringently for project ${projectId}`);
      if (existingReport) console.log(`[AI] Previous result ignored due to force flag`);
      await clearPreviousJobState(db, projectId);
    } else {
      if (existingReport && existingReport.status === "completed") {
        return res.status(400).json({ error: "Analysis already completed" });
      }

      if (existingReport && existingReport.status !== "failed") {
        const existingJob = await db.collection("jobs").findOne({ report_id: existingReport._id });
        return res.status(200).json({
          status: existingReport.status,
          jobId: existingJob ? (existingJob.bullmq_id || existingJob.id || existingJob._id.toString()) : null,
          message: "Analysis is already in progress",
          analysisMode: existingReport.analysis_mode,
          reportId: existingReport._id.toString()
        });
      }
    }

    // Determine which pipeline will be used (purely informational at this stage)
    const analysisMode = project.local_path ? "repomix" : "github_rag";

    // Create the ai_report record upfront with "queued" status
    // so the frontend can poll its status immediately
    const reportResult = await db.collection("ai_reports").insertOne({
      project_id: projectId,
      status: "queued",
      progress: 0,
      message: "Analysis job queued",
      analysis_mode: analysisMode,           // ← shows mode before job starts
      created_at: new Date(),
      generated_at: null
    });
    const reportId = reportResult.insertedId.toString();

    const job = await addAiJob(project._id.toString(), reportId);
    if (!job) {
      await db.collection("ai_reports").deleteOne({ _id: reportResult.insertedId });
      return res.status(503).json({ error: "AI queue is not available" });
    }

    if (job.isDuplicate) {
      await db.collection("ai_reports").deleteOne({ _id: reportResult.insertedId });
      return res.status(200).json({
        status: job.status || "processing",
        jobId: job.id,
        message: "Analysis is already in progress",
        analysisMode,
        reportId: job.report_id ? job.report_id.toString() : reportId
      });
    }

    await db.collection("jobs").insertOne({
      bullmq_id: job.id,
      project_id: projectId,
      report_id: reportResult.insertedId,
      type: `ai_analysis_${analysisMode}`,
      status: "queued",
      created_at: new Date()
    });

    res.status(202).json({
      status: "queued",
      jobId: job.id,
      message: "AI analysis queued",
      analysisMode,
      reportId
    });
  } catch (error) {
    console.error("Error queueing AI analysis:", error);
    return res.status(error.statusCode || 500).json({ error: error.statusCode === 429 ? error.message : "Failed to queue analysis" });
  }
}


/**
 * POST /api/projects/:id/ai/analyze/repomix
 * Queues a Repomix-mode analysis job (requires project.local_path to be set).
 * This mode packs the local repo via `npx repomix`, then uses hierarchical
 * LLM summarization instead of GitHub API per-file fetching + Qdrant RAG.
 */
async function runAnalysisRepomixJob(req, res) {
  try {
    await checkAndIncrementAnalysisLimit(req.user.id, req.user.email);
    const db = getDb();
    const projectId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.user.id);

    const project = await db.collection("projects").findOne({ _id: projectId, user_id: userId });
    if (!project) return res.status(404).json({ error: "Project not found" });

    const existingReport = await getReport(projectId);
    const force = req.body?.force === true;

    if (force) {
      console.log(`[AI] Re-run requested stringently for project ${projectId} (Repomix)`);
      if (existingReport) console.log(`[AI] Previous result ignored due to force flag`);
      await clearPreviousJobState(db, projectId);
    } else {
      if (existingReport && existingReport.status === "completed") {
        return res.status(400).json({ error: "Analysis already completed" });
      }

      if (existingReport && existingReport.status !== "failed") {
        const existingJob = await db.collection("jobs").findOne({ report_id: existingReport._id });
        return res.status(200).json({
          status: existingReport.status,
          jobId: existingJob ? (existingJob.bullmq_id || existingJob.id || existingJob._id.toString()) : null,
          message: "Analysis is already in progress",
          analysisMode: existingReport.analysis_mode,
          reportId: existingReport._id.toString()
        });
      }
    }

    // Repomix requires a locally cloned repo path
    if (!project.local_path) {
      return res.status(400).json({
        error: "Repomix mode requires a locally cloned repository. " +
               "Set 'local_path' on the project to point to the local clone directory.",
        hint: "Use the standard /ai/analyze/queue endpoint for remote-only GitHub repositories."
      });
    }

    // Create the ai_report record upfront with "queued" status
    const reportResult = await db.collection("ai_reports").insertOne({
      project_id: projectId,
      status: "queued",
      progress: 0,
      message: "Repomix analysis job queued",
      analysis_mode: "repomix",
      created_at: new Date(),
      generated_at: null
    });
    const reportId = reportResult.insertedId.toString();

    const job = await addRepomixJob(project._id.toString(), reportId);
    if (!job) {
      await db.collection("ai_reports").deleteOne({ _id: reportResult.insertedId });
      return res.status(503).json({ error: "AI queue is not available" });
    }

    if (job.isDuplicate) {
      await db.collection("ai_reports").deleteOne({ _id: reportResult.insertedId });
      return res.status(200).json({
        status: job.status || "processing",
        jobId: job.id,
        message: "Analysis is already in progress",
        analysisMode: "repomix",
        reportId: job.report_id ? job.report_id.toString() : reportId
      });
    }

    await db.collection("jobs").insertOne({
      bullmq_id: job.id,
      project_id: projectId,
      report_id: reportResult.insertedId,
      type: "ai_analysis_repomix",
      status: "queued",
      created_at: new Date()
    });

    res.status(202).json({
      status: "queued",
      jobId: job.id,
      message: "Repomix AI analysis queued",
      analysisMode: "repomix",
      reportId
    });
  } catch (error) {
    console.error("Error queueing Repomix AI analysis:", error);
    return res.status(error.statusCode || 500).json({ error: error.statusCode === 429 ? error.message : "Failed to queue Repomix analysis" });
  }
}

module.exports = {
  getLatestReport,
  getReportHistory,
  runFullAnalysis,
  runAnalysisAsJob,
  runAnalysisRepomixJob
};
