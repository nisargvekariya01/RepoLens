const { Worker } = require("bullmq");
const { ObjectId } = require("mongodb");
const connection = require("../config/redis");
const { getDb } = require("../config/db");
const { JOB_TYPES, addGenerateReportJob, addRepomixGenerateReportJob } = require("./aiAnalysis.queue");
const { indexRepositoryContext, generateFullAIReport } = require("../services/aiAnalysis.service");
const { listRepoFiles, getFileContent } = require("../services/githubFiles.service");
const githubService = require("../services/github.service");
const { CURRENT_EMBEDDING_VERSION } = require("../utils/chunkCode.utils");
const { deleteProjectChunks } = require("../services/vectorStore.service");
const { safeDecryptToken } = require("../utils/tokenEncryption");

/**
 * Resolve a plaintext GitHub token for a user document.
 * Priority: encrypted field → legacy plaintext → env GITHUB_TOKEN.
 * NEVER logs the token value.
 */
function resolveGitHubToken(user) {
  if (user?.github?.access_token_encrypted) {
    const decrypted = safeDecryptToken(user.github.access_token_encrypted);
    if (decrypted) return decrypted;
  }
  // Legacy plaintext fallback
  if (user?.github_access_token) return user.github_access_token;
  // Last resort: server-level env token
  return process.env.GITHUB_TOKEN || null;
}

const CONCURRENCY = 1;


const aiWorker = connection
  ? new Worker(
      "ai-analysis",
      async (job) => {
        const { projectId, reportId } = job.data;

        const startTime = Date.now();
        const MAX_TIME = 300000; // 5 minutes max per step

        // Add internal watchdog inside the worker context
        const watchdog = setInterval(() => {
          if (Date.now() - startTime > MAX_TIME) {
            failReportSafely(job, reportId, "Timeout: Job execution exceeded maximum allowed time.");
            clearInterval(watchdog);
          }
        }, 10000);

        try {
          // Guard: wait for MongoDB if worker picked up a job before DB connected
          await waitForDb();

          // ── DISPATCHER ──────────────────────────────────────────────────────
          switch (job.name) {
            case JOB_TYPES.ANALYZE_REPO:
              await handleAnalyzeRepo(projectId, reportId, job);
              break;
            case JOB_TYPES.GENERATE_REPORT:
              await handleGenerateReport(projectId, reportId, job);
              break;
            case JOB_TYPES.REPOMIX_ANALYZE:
              await handleAnalyzeRepoRepomix(projectId, reportId, job);
              break;
            case JOB_TYPES.REPOMIX_GENERATE_REPORT:
              await handleGenerateReportRepomix(projectId, reportId, job);
              break;
            default:
              console.log(`[AI Worker] Skipping legacy step ${job.name}. Pipeline uses monolithic RAG now.`);
          }
        } catch (err) {
          await failReportSafely(job, reportId, err.message || "Unknown pipeline error");
          throw err;
        } finally {
          clearInterval(watchdog);
        }
      },
      {
        connection,
        concurrency: CONCURRENCY,
        limiter: {
          max: 5,
          duration: 1000
        },
        lockDuration: 600000,     // 10 minute lock preventing stalled timeouts
        settings: {
          stalledInterval: 30000,
          maxStalledCount: 5
        }
      }
    )
  : null;

// ─── HELPER: Wait for MongoDB to be ready ─────────────────────────────────────
// BullMQ picks up stale Redis jobs immediately at startup, before MongoDB connects.
// This guard retries getDb() up to 30s so jobs don't fail with "DB not initialized".
async function waitForDb(maxWaitMs = 30000) {
  const interval = 1000;
  let waited = 0;
  while (waited < maxWaitMs) {
    try {
      getDb(); // throws if not ready
      return;  // success
    } catch (_) {
      await new Promise((r) => setTimeout(r, interval));
      waited += interval;
    }
  }
  throw new Error("Database not initialized after 30s — aborting job.");
}



// Status map: internal worker states → canonical job schema states
// Worker uses 'active'/'processing' internally; DB/UI schema uses 'running'
function normalizeStatus(status) {
  if (status === "active") return "running";
  return status; // pending, running, completed, failed
}

// ─── HELPER: Unified Job State Updater (ai_reports + jobs) ─────────────────────
async function updateJobState(job, reportId, data) {
  const db = getDb();
  const { progress, message } = data;
  const status = data.status ? normalizeStatus(data.status) : undefined;

  if (job && progress !== undefined && progress !== null) {
    try { await job.updateProgress(progress); } catch (_) {}
  }

  const setPayload = { updated_at: Date.now() };
  if (status) setPayload.status = status;
  if (progress !== undefined) setPayload.progress = progress;
  if (message) setPayload.message = message;
  
  // Legacy mappings
  if (progress !== undefined && progress !== null) setPayload.processing_progress = progress;
  if (message) setPayload.processing_status = message;

  if (reportId) {
    try {
      await db.collection("ai_reports").updateOne(
        { _id: new ObjectId(reportId) },
        { $set: setPayload }
      );
    } catch (e) {}
  }

  if (job && job.id) {
    try {
      await db.collection("jobs").updateOne(
        { bullmq_id: job.id },
        { $set: setPayload }
      );
    } catch (e) {}
    
    if (global.io) {
      const room = job.id.toString();
      global.io.to(room).emit("job:update", {
        jobId: room,
        progress,
        status,
        message
      });
      
      if (status === "completed") {
        // Emit job:complete with both jobId and projectId so frontend can react
        const projectId = job.data?.projectId || null;
        global.io.to(room).emit("job:complete", {
          status: "completed",
          reportId: reportId ? reportId.toString() : null,
          projectId
        });
        // Emit project-scoped event for any listeners on projectId room
        if (projectId) {
          global.io.to(projectId.toString()).emit("ai:completed", {
            projectId: projectId.toString(),
            reportId: reportId ? reportId.toString() : null
          });
        }
      }
    }
  }
}

// ─── HELPER: Safely Update Job Status on Failure ─────────────────────────────
async function failReportSafely(job, reportId, errorMsg) {
  if (!reportId) return;
  console.error(`[AI Worker] Saved failure state to DB for report ${reportId}`);
  await updateJobState(job, reportId, {
    status: "failed",
    message: errorMsg,
    progress: null
  });
  
  // Also explicitly store the core error field on the report
  try {
    await getDb().collection("ai_reports").updateOne(
      { _id: new ObjectId(reportId) },
      { $set: { error: errorMsg } }
    );
  } catch (_) {}
}

// ─── HELPERS: auto-clone ──────────────────────────────────────────────────────

const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

/** Directory where repos are cloned. Override via REPOS_DIR env var. */
const REPOS_BASE_DIR = process.env.REPOS_DIR
  ? path.resolve(process.env.REPOS_DIR)
  : path.resolve(__dirname, "../../repos");

/**
 * Clone a GitHub repo into REPOS_BASE_DIR/<projectId>.
 * Uses authenticated URL if token is available.
 * Returns the absolute local path on success.
 */
function cloneRepository(repoOwner, repoName, projectId, token) {
  return new Promise((resolve, reject) => {
    const clonePath = path.join(REPOS_BASE_DIR, projectId);

    // Skip clone if the directory already exists (resumable)
    if (fs.existsSync(clonePath)) {
      console.log(`[AI] Repo directory already exists at ${clonePath} — skipping clone.`);
      return resolve(clonePath);
    }

    // Ensure base directory exists
    fs.mkdirSync(REPOS_BASE_DIR, { recursive: true });

    // Build authenticated or public clone URL.
    // SECURITY: token is embedded in URL but never logged — sanitized display below.
    const publicUrl = `https://github.com/${repoOwner}/${repoName}.git`;
    const repoUrl = token
      ? `https://x-access-token:${token}@github.com/${repoOwner}/${repoName}.git`
      : publicUrl;

    console.log(`[System] Repo cloning started (nodemon safe)`);
    console.log(`[AI] Cloning ${publicUrl} → ${clonePath}${token ? " (authenticated)" : " (public)"}`);

    const child = spawn(
      "git",
      ["clone", "--depth", "1", repoUrl, clonePath],
      // shell: false (default) — Node passes args directly, so spaces in paths work
      { shell: false, stdio: ["ignore", "pipe", "pipe"] }
    );

    let stderr = "";
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("[AI] git clone timed out after 5 minutes"));
    }, 5 * 60 * 1000);

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        console.log(`[AI] Repo cloned successfully → ${clonePath}`);
        resolve(clonePath);
      } else {
        reject(new Error(`git clone exited ${code}: ${stderr.slice(0, 300)}`));
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`[AI] Spawn error during git clone: ${err.message}`));
    });
  });
}

// ─── STAGE 1 (Always-Repomix): auto-clone if needed, then run Repomix ─────────
async function handleAnalyzeRepo(projectId, reportId, job) {
  try {
    console.log(`\n[AI:ANALYZE_REPO] START project=${projectId} report=${reportId}`);
    const db = getDb();
    const pId = new ObjectId(projectId);

    const project = await db.collection("projects").findOne({ _id: pId });
    if (!project) throw new Error("Project not found in DB");

    await updateJobState(job, reportId, {
      status: "running",
      progress: 1,
      message: "Preparing repository..."
    });

    const user = await db.collection("users").findOne({ _id: new ObjectId(project.user_id) });
    const token = resolveGitHubToken(user);

    // ── STEP 1: Ensure local_path — clone if missing or deleted ────────────────
    const fs = require("fs");
    if (!project.local_path || !fs.existsSync(project.local_path)) {
      console.log(`[AI] local_path missing → cloning repo...`);
      await updateJobState(job, reportId, {
        status: "processing",
        progress: 2,
        message: "Cloning repository locally..."
      });

      try {
        const clonedPath = await cloneRepository(
          project.repo_owner,
          project.repo_name,
          projectId,
          token
        );

        // Persist local_path so future runs skip the clone
        await db.collection("projects").updateOne(
          { _id: pId },
          { $set: { local_path: clonedPath } }
        );
        project.local_path = clonedPath; // update in-memory reference

        console.log(`[AI] Repomix mode activated`);
      } catch (cloneErr) {
        // ── Clone failed → last-resort fallback to GitHub API (capped) ──────
        console.error(`[AI] Clone failed: ${cloneErr.message}`);
        console.warn(`[AI] Falling back to GitHub API + Qdrant pipeline (last resort).`);
        return await handleAnalyzeRepoGitHubFallback(projectId, reportId, job, project, token, db);
      }
    } else {
      console.log(`[AI] local_path present: ${project.local_path}`);
      console.log(`[AI] Repomix mode activated`);
    }

    // ── STEP 2: Always delegate to Repomix pipeline ────────────────────────────
    return await handleAnalyzeRepoRepomix(projectId, reportId, job);
  } catch (error) {
    console.error(`[AI:ANALYZE_REPO] FATAL PIPELINE ERROR:`, error);
    await failReportSafely(job, reportId, error.message);
    throw error;
  }
}

// ─── LAST-RESORT FALLBACK: GitHub API + Qdrant (clone failed) ─────────────────
async function handleAnalyzeRepoGitHubFallback(projectId, reportId, job, project, token, db) {
  const MAX_FILES_TO_INDEX = 100;
  const BATCH_SIZE = 3;

  if (reportId) {
    await updateJobState(job, reportId, {
      status: "processing",
      progress: 5,
      message: `Fallback: embedding ${MAX_FILES_TO_INDEX} files via GitHub API...`
    });
  }

  console.log(`[AI:FALLBACK] Fetching file list from GitHub (max ${MAX_FILES_TO_INDEX})...`);
  const allFilesMeta = await listRepoFiles(project.repo_owner, project.repo_name, token);
  const filesMeta = allFilesMeta.slice(0, MAX_FILES_TO_INDEX);
  const totalToProcess = filesMeta.length;
  console.log(`[AI:FALLBACK] ${allFilesMeta.length} discovered, processing ${totalToProcess}.`);

  for (let i = 0; i < totalToProcess; i += BATCH_SIZE) {
    const batchMeta = filesMeta.slice(i, i + BATCH_SIZE);
    const filesContentArray = [];

    await Promise.all(batchMeta.map(async (meta) => {
      try {
        const content = await getFileContent(project.repo_owner, project.repo_name, meta.path, token);
        if (content) filesContentArray.push({ path: meta.path, content });
      } catch (fileErr) {
        console.error(`[AI:FALLBACK] Error fetching ${meta.path}:`, fileErr.message);
      }
    }));

    await indexRepositoryContext(projectId, filesContentArray, job);

    const processedCount = Math.min(i + BATCH_SIZE, totalToProcess);
    const percentage = 5 + Math.round((processedCount / totalToProcess) * 75);
    await updateJobState(job, reportId, {
      status: "processing",
      progress: percentage,
      message: `Indexing files: ${processedCount}/${totalToProcess}`
    });
  }

  console.log(`[AI] Starting repo summarization...`);
  if (reportId) {
    await updateJobState(job, reportId, {
      status: "processing",
      progress: 82,
      message: "RAG index ready — generating AI summaries..."
    });
  }
  await addGenerateReportJob(projectId, reportId);
}


// ── STAGE 2 (Auto-routing): Code-intelligence report ────────────────────────────────────
// ALWAYS uses code-analysis mode. GitHub data is NEVER sent to the LLM.
async function handleGenerateReport(projectId, reportId, job) {
  try {
    console.log(`\n[AI:GENERATE_REPORT] START project=${projectId} report=${reportId}`);
    console.log(`[AI:GENERATE_REPORT] Mode: CODE_ANALYSIS_ONLY (no GitHub data)`);
    const db = getDb();
    const pId = new ObjectId(projectId);

    if (reportId) {
      await updateJobState(job, reportId, {
        status: "active",
        progress: 85,
        message: "Running code intelligence analysis..."
      });
    }

    const project = await db.collection("projects").findOne({ _id: pId });
    if (!project) throw new Error("Project not found");

    const allSnapshots = await db.collection("project_snapshots")
      .find({ project_id: pId }).sort({ snapshot_date: -1 }).limit(10).toArray();
    const latestSnapshot = allSnapshots[0] || null;

    // ── Check if Repomix summary was pre-computed (Stage 1 auto-routing) ──────────
    let repomixSummary = null;
    if (reportId) {
      const existingReport = await db.collection("ai_reports").findOne({ _id: new ObjectId(reportId) });
      repomixSummary = existingReport?.repomix_summary || null;
    }

    // generateFullAIReport handles both cases (summary present OR absent via inline RAG)
    // NOTE: issues=[], commits=[] are passed but NEVER used by generateFullAIReport
    console.log(`[AI:GENERATE_REPORT] ${repomixSummary ? "Using stored repomix_summary" : "No summary found — generateFullAIReport will run inline RAG"}`);
    const report = await generateFullAIReport(
      project, latestSnapshot, allSnapshots, [], [], repomixSummary
    );
    console.log(`[AI:GENERATE_REPORT] Code-only report generated.`);

    if (reportId) {
      await db.collection("ai_reports").updateOne(
        { _id: new ObjectId(reportId) },
        {
          $set: {
            snapshot_id:       latestSnapshot ? latestSnapshot._id : null,
            code_quality_score: report.code_quality_score ?? null,
            issues_data:       report.issues_data,
            trend_data:        report.trend_data,
            tech_trend_data:   report.tech_trend_data,
            future_score_data: report.future_score_data,
            suggestions_data:  report.suggestions_data,
            risk_data:         report.risk_data,
            analysis_mode: "code_analysis",
            generated_at: new Date()
          }
        }
      );

      await updateJobState(job, reportId, {
        status: "completed",
        progress: 100,
        message: "Complete"
      });
    } else {
      await db.collection("ai_reports").insertOne({
        project_id:        pId,
        snapshot_id:       latestSnapshot ? latestSnapshot._id : null,
        status:            "completed",
        message:           "Complete",
        progress:          100,
        code_quality_score: report.code_quality_score ?? null,
        issues_data:       report.issues_data,
        trend_data:        report.trend_data,
        tech_trend_data:   report.tech_trend_data,
        future_score_data: report.future_score_data,
        suggestions_data:  report.suggestions_data,
        risk_data:         report.risk_data,
        analysis_mode:     "code_analysis",
        processing_status: "Complete",
        processing_progress: 100,
        generated_at: new Date()
      });
    }

    console.log(`[AI:GENERATE_REPORT] ✅ ALL STAGES COMPLETE for project ${project.repo_name}`);
  } catch (error) {
    console.error(`[AI:GENERATE_REPORT] FATAL ERROR IN AGGREGATION:`, error);
    await failReportSafely(job, reportId, error.message);
    throw error;
  }
}

// ─── STAGE 1 (Repomix mode): Run Repomix CLI → Parse XML → Chunk → Embed into Qdrant ──
// ⚠️  NO LLM calls in this stage — indexing only.

async function handleAnalyzeRepoRepomix(projectId, reportId, job) {
  try {
    console.log(`\n[AI:REPOMIX_ANALYZE] START project=${projectId} report=${reportId}`);
    console.log("[AI] Job started");
    const db = getDb();
    const pId = new ObjectId(projectId);

    await db.collection("ai_reports").updateOne(
      { _id: new ObjectId(reportId) },
      {
        $set: {
          status: "running",
          message: "Initializing...",
          progress: 5,
          started_at: new Date(),
          analysis_mode: "repomix",
          processing_status: "Initializing...",
          processing_progress: 5,
        },
      }
    );
    if (job) await job.updateProgress(5);

    const project = await db.collection("projects").findOne({ _id: pId });
    if (!project) throw new Error("Project not found in DB");

    // Lazy-require Repomix services
    const { runRepomixPipeline } = require("../services/repomix.service");
    const { indexRepositoryContext } = require("../services/aiAnalysis.service");

    const user = await db.collection("users").findOne({ _id: new ObjectId(project.user_id) });
    const token = user?.github_access_token || null;

    // Get latest commit SHA for cache keying (non-fatal)
    let latestCommitSha = null;
    try {
      const commits = await githubService.getRecentCommits(project.repo_owner, project.repo_name, token);
      latestCommitSha = commits?.[0]?.sha || null;
    } catch (_) {}

    // ── Step 1: Run Repomix → parse XML → smart filter → return per-file data ─
    // v2: repomix returns `files` (per-file, sorted by priority) instead of pre-packed chunks.
    // Logical boundary chunking now happens inside indexRepositoryContext().
    const { projectTree, files, tokenCount, fromCache } = await runRepomixPipeline(
      project,
      latestCommitSha,
      async (pct, msg) => {
        await updateJobState(job, reportId, { status: "processing", progress: pct, message: msg });
      }
    );

    console.log("[AI] Repomix done");
    console.log(
      `[AI:REPOMIX_ANALYZE] Repomix: ${files.length} files, ~${tokenCount} tokens` +
        (fromCache ? " [FROM CACHE]" : " [FRESH]")
    );

    await db.collection("ai_reports").updateOne(
      { _id: new ObjectId(reportId) },
      {
        $set: {
          status: "processing",
          message: "Preparing embeddings...",
          progress: 50,
          processing_status: "Preparing embeddings...",
          processing_progress: 50,
          repomix_file_count: files.length,
          repomix_from_cache: fromCache,
        },
      }
    );
    if (job) await job.updateProgress(50);

    // ── Step 2: Embed files into Qdrant (no LLM — indexing only) ─────────────
    //
    // v2 Cache policy (version-driven automatic reindexing):
    //   • Same commit SHA AND same embedding version AND status=completed AND NOT force → skip
    //   • Different embedding version → clear Qdrant index first, then re-embed
    //   • Different commit SHA → re-embed (repo changed)
    //   • force=true → always re-embed

    const aiReportDoc = await db.collection("ai_reports").findOne({ _id: new ObjectId(reportId) });
    const isForceRun  = aiReportDoc?.force === true;
    const repoHash    = latestCommitSha;

    const isCacheHit =
      fromCache &&
      project.embedding_hash    === repoHash &&
      project.embedding_version === CURRENT_EMBEDDING_VERSION &&
      project.embedding_status  === "completed" &&
      !isForceRun;

    if (isCacheHit) {
      console.log(`[AI] Embeddings are current (hash=${repoHash?.slice(0,8)}, v=${CURRENT_EMBEDDING_VERSION}). Skipping re-embedding.`);
      await updateJobState(job, reportId, {
        status:   "processing",
        progress: 80,
        message:  "Using cached Qdrant embeddings...",
      });
    } else {
      // Version mismatch → clear stale Qdrant index before re-embedding
      if (project.embedding_version && project.embedding_version !== CURRENT_EMBEDDING_VERSION) {
        console.log(`[AI:REPOMIX_ANALYZE] Embedding version changed (${project.embedding_version} → ${CURRENT_EMBEDDING_VERSION}). Clearing stale Qdrant index...`);
        await deleteProjectChunks("codebase_index", projectId);
      }

      console.log(`[AI:REPOMIX_ANALYZE] (Re-)embedding ${files.length} files into Qdrant vector index...`);

      await indexRepositoryContext(projectId, files, async (completed, total) => {
        const pct = 50 + Math.round((completed / Math.max(total, 1)) * 30); // scale 50→80
        await updateJobState(job, reportId, {
          status:   "processing",
          progress: pct,
          message:  `Embedding chunk ${completed}/${total}...`,
        });
      });
      console.log("[AI] Embedding complete");

      await db.collection("projects").updateOne(
        { _id: pId },
        {
          $set: {
            embedding_status:  "completed",
            embedding_hash:    repoHash,
            embedding_version: CURRENT_EMBEDDING_VERSION,
          },
        }
      );
    }

    await updateJobState(job, reportId, {
      status: "processing",
      progress: 80,
      message: "Aggregating results...",
      repomix_indexed_at: new Date(),
      repomix_file_count: files.length,
    });

    console.log(`[AI:REPOMIX_ANALYZE] ✅ Indexing complete. Queuing final report job...`);

    // ── Step 3: Queue GENERATE_REPORT (will use focused RAG queries, not full chunk loop) ─
    await addGenerateReportJob(projectId, reportId);
  } catch (error) {
    console.error(`[AI:REPOMIX_ANALYZE] FATAL PIPELINE ERROR:`, error);
    await failReportSafely(job, reportId, error.message);
    throw error;
  } finally {
    // ── Step 4: Auto-cleanup cloned repository (Always runs) ────────────────────────────────
    try {
      const fs = require("fs");
      const db = getDb();
      const pId = new ObjectId(projectId);
      const project = await db.collection("projects").findOne({ _id: pId });
      
      if (project && project.local_path && fs.existsSync(project.local_path)) {
        console.log(`[AI:REPOMIX_ANALYZE] Auto-cleaning up repo: ${project.local_path}`);
        fs.rmSync(project.local_path, { recursive: true, force: true });
        
        // Unset it from DB so it's treated as "deleted"
        await db.collection("projects").updateOne(
          { _id: pId },
          { $unset: { local_path: "" } }
        );
      }
    } catch (cleanupErr) {
      console.warn(`[AI:REPOMIX_ANALYZE] Failed to clean up repo folder:`, cleanupErr.message);
    }
  }
}


// ─── STAGE 2 (Repomix mode): Fast RAG-based report generation ─────────────────
// Uses 4 focused Qdrant queries instead of sending all 300+ chunks to LLM.
// Time: ~30s vs. minutes. Token usage: ~5000 vs. 150 000+.

async function handleGenerateReportRepomix(projectId, reportId, job) {
  try {
    console.log(`\n[AI:REPOMIX_GENERATE_REPORT] START (RAG mode) project=${projectId}`);
    const db = getDb();
    const pId = new ObjectId(projectId);

    await db.collection("ai_reports").updateOne(
      { _id: new ObjectId(reportId) },
      { $set: { 
          status: "active",
          message: "Aggregating results...",
          progress: 80,
          processing_status: "Aggregating results...", 
          processing_progress: 80 
        } 
      }
    );
    if (job) await job.updateProgress(80);

    const project = await db.collection("projects").findOne({ _id: pId });
    if (!project) throw new Error("Project not found");

    const allSnapshots = await db.collection("project_snapshots")
      .find({ project_id: pId }).sort({ snapshot_date: -1 }).limit(10).toArray();
    const latestSnapshot = allSnapshots[0] || null;

    const user = await db.collection("users").findOne({ _id: new ObjectId(project.user_id) });
    const token = user?.github_access_token || null;

    const { generateRAGReport } = require("../services/ragQuery.service");
    const { generateFullAIReport } = require("../services/aiAnalysis.service");

    console.log(`[AI:REPOMIX_GENERATE_REPORT] Running 4 focused RAG queries...`);

    // Generate structured code analysis via focused top-k RAG queries
    const ragSummary = await generateRAGReport(
      projectId,
      project.name || project.repo_name
    );
    console.log("[AI] Summaries done");

    console.log(`[AI:REPOMIX_GENERATE_REPORT] RAG analysis complete. Building code-only report...`);
    await updateJobState(job, reportId, { status: "processing", progress: 90, message: "Finalizing code-only report..." });

    // NOTE: issues and commits are NOT fetched — not needed in code-only mode
    const report = await generateFullAIReport(
      project, latestSnapshot, allSnapshots, [], [], ragSummary
    );

    if (job) await updateJobState(job, reportId, { progress: 95, message: "Saving report..." });

    await db.collection("ai_reports").updateOne(
      { _id: new ObjectId(reportId) },
      {
        $set: {
          snapshot_id:       latestSnapshot ? latestSnapshot._id : null,
          code_quality_score: report.code_quality_score ?? null,
          issues_data:       report.issues_data,
          trend_data:        report.trend_data,
          tech_trend_data:   report.tech_trend_data,
          future_score_data: report.future_score_data,
          suggestions_data:  report.suggestions_data,
          risk_data:         report.risk_data,
          repomix_summary:   ragSummary,
          analysis_mode:     "repomix_rag",
          generated_at: new Date(),
        },
      }
    );

    await updateJobState(job, reportId, {
      status: "completed",
      progress: 100,
      message: "Complete"
    });
    
    console.log("[AI] Job completed");

    console.log(`[AI:REPOMIX_GENERATE_REPORT] ✅ ALL STAGES COMPLETE (RAG) for ${project.repo_name}`);
  } catch (error) {
    console.error(`[AI:REPOMIX_GENERATE_REPORT] FATAL ERROR:`, error);
    await failReportSafely(job, reportId, error.message);
    throw error;
  }
}

if (aiWorker) {
  aiWorker.on("failed", async (job, err) => {
    console.error(`[AI Worker] Job ${job?.id} (${job?.name}) failed intrinsically: ${err.message}`);
    
    // Catch framework-level errors (like Timeouts or Retries exhausted) 
    // and broadcast them so the UI doesn't hang.
    if (job?.data?.reportId) {
      const explicitError = err.name === 'TimeoutError' 
        ? "Job exceeded maximum processing time limit of 5 minutes." 
        : err.message;
        
      await failReportSafely(job, job.data.reportId, explicitError);
    }
  });
}

module.exports = aiWorker;
