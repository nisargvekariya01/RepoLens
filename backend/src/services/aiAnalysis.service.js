/**
 * aiAnalysis.service.js
 *
 * Core indexing (RAG setup) and report generation service.
 *
 * v2 changes (RAG precision upgrade):
 *   - chunkCode() replaced with chunkFileAtBoundaries() from chunkCode.utils
 *   - indexRepositoryContext() does per-file chunking (no cross-file mixing)
 *   - Each chunk's Qdrant payload includes: priority, language, chunk_tokens, embedding_version
 *   - Version-aware: embedding_version stored with each point for auto-invalidation detection
 *   - MAX_INDEXED_CHUNKS raised from 80 → 500 (precision over compression)
 *   - HIGH priority files indexed first (consume the chunk cap first)
 */

const { callLLM }                           = require("./llm.service");
const { generateEmbedding }                 = require("./embedding.service");
const { initCollection, upsertFileChunks }  = require("./vectorStore.service");
const { buildRepoContext }                  = require("./aiContext.builder");
const { searchSimilarChunks }               = require("./vectorStore.service");
const {
  chunkFileAtBoundaries,
  scoreFilePriority,
  getLanguageFromPath,
  isNoiseFile,
  estimateTokens,
  CURRENT_EMBEDDING_VERSION,
  CHUNKING_CONFIG,
} = require("../utils/chunkCode.utils");
const crypto = require("crypto");

const COLLECTION_NAME = "codebase_index";

/**
 * Hard limit on indexed chunks per project.
 * HIGH priority files are indexed first, so the most valuable code always fits.
 */
const MAX_INDEXED_CHUNKS = parseInt(process.env.RAG_MAX_INDEXED_CHUNKS || "500", 10);

// ─── Concurrency Limiter ────────────────────────────────────────────────────

/** Lightweight native concurrency limiter (replaces p-limit dependency). */
function pLimit(concurrency) {
  const queue = [];
  let activeCount = 0;

  const next = () => {
    activeCount--;
    if (queue.length > 0) queue.shift()();
  };

  return async (fn) => {
    if (activeCount >= concurrency) {
      await new Promise((resolve) => queue.push(resolve));
    }
    activeCount++;
    try {
      return await fn();
    } finally {
      next();
    }
  };
}

// ─── INDEXING (RAG SETUP) ────────────────────────────────────────────────────

/**
 * Chunk, embed, and upsert all files from a repository into Qdrant.
 *
 * Key behaviours (v2):
 *   1. Each file is chunked INDEPENDENTLY using logical boundary detection.
 *      No two files share a chunk — file paths in Qdrant payloads are always singular.
 *   2. Files are sorted HIGH → MEDIUM priority so the chunk cap preserves signal.
 *   3. Noise files (binaries, docs, secrets) are skipped silently.
 *   4. Each Qdrant point payload includes: priority, language, chunk_tokens,
 *      embedding_version — enabling future filtered searches and auto-invalidation.
 *   5. Embedding string = "File: {path}\n\n{overlapPrefix}{chunkText}" so MiniLM
 *      captures file path context for better semantic retrieval.
 *
 * @param {string}   projectId        - MongoDB project _id (string or ObjectId)
 * @param {Array}    filesContentArray - [{ path, content, priority?, language? }]
 * @param {Function} onProgress       - Optional async (completed, total) callback
 */
async function indexRepositoryContext(projectId, filesContentArray, onProgress = null) {
  await initCollection(COLLECTION_NAME);

  console.log(`\n[AI:Index] ── Indexing start ──────────────────────────────────`);
  console.log(`[AI:Index] Project: ${projectId}`);
  console.log(`[AI:Index] Input files: ${filesContentArray.length}`);
  console.log(`[AI:Index] Embedding version: ${CURRENT_EMBEDDING_VERSION}`);
  console.log(`[AI:Index] Chunk strategy: ${CHUNKING_CONFIG.strategy} (target=${CHUNKING_CONFIG.targetTokens}tok, overlap=${CHUNKING_CONFIG.overlapTokens}tok)`);

  // ── Step 1: Filter noise files ────────────────────────────────────────────
  const validFiles = filesContentArray.filter((f) => {
    if (!f.content || f.content.trim().length === 0) return false;
    if (isNoiseFile(f.path)) {
      console.log(`[AI:Index] Skipping noise file: ${f.path}`);
      return false;
    }
    return true;
  });

  // ── Step 2: Sort by priority (HIGH first) ─────────────────────────────────
  const sortedFiles = validFiles
    .map((f) => {
      const ps = f.priority
        ? { priority: f.priority, score: f.priority === "high" ? 0 : f.priority === "medium" ? 1 : 2 }
        : scoreFilePriority(f.path);
      return {
        ...f,
        priority: ps.priority,
        priorityScore: ps.score,
        language: f.language || getLanguageFromPath(f.path),
      };
    })
    .sort((a, b) => {
      if (a.priorityScore !== b.priorityScore) return a.priorityScore - b.priorityScore;
      return a.path.localeCompare(b.path);
    });

  console.log(`[AI:Index] Valid files after noise filter: ${sortedFiles.length}`);
  console.log(`[AI:Index] Priority — HIGH: ${sortedFiles.filter((f) => f.priority === "high").length}, MEDIUM: ${sortedFiles.filter((f) => f.priority === "medium").length}`);

  // ── Step 3: Generate all sub-chunks (per-file, at logical boundaries) ──────
  const allSubChunks = [];

  for (const file of sortedFiles) {
    const fileChunks = chunkFileAtBoundaries(file.path, file.content);
    for (const chunk of fileChunks) {
      allSubChunks.push({
        path:            file.path,
        priority:        file.priority,
        language:        file.language,
        chunkIndex:      chunk.chunkIndex,
        text:            chunk.text,
        embeddingPrefix: chunk.embeddingPrefix,
        tokens:          chunk.tokens,
      });
    }
  }

  // ── Step 4: Apply chunk cap (HIGH priority preserved — sorted first) ───────
  let cappedChunks = allSubChunks;
  if (allSubChunks.length > MAX_INDEXED_CHUNKS) {
    console.warn(`[AI:Index] Chunk cap hit: ${allSubChunks.length} → ${MAX_INDEXED_CHUNKS} (HIGH priority preserved)`);
    cappedChunks = allSubChunks.slice(0, MAX_INDEXED_CHUNKS);
  }

  const avgTokens = cappedChunks.length > 0
    ? Math.round(cappedChunks.reduce((s, c) => s + c.tokens, 0) / cappedChunks.length)
    : 0;

  const filesContributing = [...new Set(cappedChunks.map((c) => c.path))].length;

  console.log(`[AI:Index] Total chunks to embed: ${cappedChunks.length}`);
  console.log(`[AI:Index] Avg tokens per chunk: ${avgTokens}`);
  console.log(`[AI:Index] Files contributing chunks: ${filesContributing}`);
  if (avgTokens > 600) {
    console.warn(`[AI:Index] ⚠️  Avg chunk size (${avgTokens} tok) is above 600 — check boundary detection`);
  }

  // ── Step 5: Embed all chunks concurrently (4 threads) ────────────────────
  const points = [];
  const limit  = pLimit(4);
  const taskPromises = [];
  let completedCount = 0;
  const totalCount   = cappedChunks.length;

  for (const item of cappedChunks) {
    // Embedding input: file path prefix + overlap (for semantic continuity) + chunk text
    const embeddingInput = [
      `File: ${item.path}`,
      item.embeddingPrefix || "",
      item.text,
    ].filter(Boolean).join("\n\n");

    taskPromises.push(
      limit(async () => {
        try {
          const vector = await generateEmbedding(embeddingInput);
          if (vector && Array.isArray(vector)) {
            points.push({
              id: crypto.randomUUID(),
              vector,
              payload: {
                project_id:        projectId.toString(),
                file_path:         item.path,
                chunk_index:       item.chunkIndex,
                content:           item.text,         // clean text (no overlap) for LLM display
                priority:          item.priority,
                language:          item.language,
                chunk_tokens:      item.tokens,
                embedding_version: CURRENT_EMBEDDING_VERSION,
              },
            });
          }
        } catch (embedErr) {
          console.error(`[AI:Index] Embed failed for chunk ${item.chunkIndex} of ${item.path}:`, embedErr.message);
        } finally {
          await new Promise((r) => setTimeout(r, 50)); // throttle burst
          completedCount++;
          if (onProgress) {
            await onProgress(completedCount, totalCount).catch(() => {});
          }
        }
      })
    );
  }

  await Promise.all(taskPromises);

  // ── Step 6: Batch upsert into Qdrant ─────────────────────────────────────
  if (points.length > 0) {
    const BATCH_SIZE = 100;
    for (let i = 0; i < points.length; i += BATCH_SIZE) {
      await upsertFileChunks(COLLECTION_NAME, points.slice(i, i + BATCH_SIZE));
    }
    console.log(`[AI:Index] ✅ Upserted ${points.length} chunks into Qdrant (${filesContributing} files)`);
  } else {
    console.warn("[AI:Index] ⚠️  No valid embedding vectors generated. Check MiniLM model status.");
  }

  console.log(`[AI:Index] ── Indexing complete ────────────────────────────────\n`);
}

// ─── RAG RETRIEVAL ───────────────────────────────────────────────────────────

/**
 * Simple single-query RAG context fetch.
 * Used by generateFullAIReport() as a fallback when no Repomix summary is available.
 *
 * @param {string} projectId
 * @param {string} queryText
 * @param {number} limit
 * @returns {string} Formatted context block
 */
async function queryRAGContext(projectId, queryText, limit = 4) {
  const queryVector = await generateEmbedding(queryText);
  if (!queryVector) return "";

  const filter = {
    must: [{ key: "project_id", match: { value: projectId.toString() } }],
  };

  const results = await searchSimilarChunks(COLLECTION_NAME, queryVector, limit, filter);
  if (!results || results.length === 0) return "No specific code context retrieved.";

  return results
    .map((r) => `[File: ${r.payload.file_path}]\n${r.payload.content}`)
    .join("\n\n---\n\n");
}

// ─── REPORT GENERATION ───────────────────────────────────────────────────────

/**
 * generateFullAIReport — ALWAYS runs in code-only mode.
 *
 * LEGACY MODE IS DELETED. GitHub issues, commits, and metrics are NEVER sent to LLM.
 *
 * Two entry paths:
 *   A. repomixSummary provided  → use RAG analysis directly (Repomix → Stage 2 path)
 *   B. repomixSummary missing   → run generateRAGReport inline (GENERATE_REPORT job path)
 *
 * In BOTH cases: zero GitHub data, zero commits, zero metrics in the LLM prompt.
 *
 * @param {Object} project
 * @param {Object} snapshot
 * @param {Array}  allSnapshots  - Not used in prompt (kept for API compat)
 * @param {Array}  issues        - IGNORED — not sent to LLM
 * @param {Array}  commits       - IGNORED — not sent to LLM
 * @param {Object} repomixSummary
 */
async function generateFullAIReport(project, snapshot, allSnapshots, issues, commits, repomixSummary = null) {
  const projectLabel = project.name || project.repo_name;
  const projectId    = (project._id || project.id).toString();

  console.log(`\n[AI] generateFullAIReport: project="${projectLabel}" mode=CODE_ANALYSIS_ONLY`);
  console.log(`[AI] NOTE: GitHub issues/commits/metrics are NOT sent to LLM (any path)`);

  // ── Path A: repomixSummary provided by caller (Repomix → STAGE 2) ─────────
  let ragSummary = repomixSummary;

  // ── Path B: no summary provided → run RAG inline ───────────────────────────
  if (!ragSummary || typeof ragSummary !== "object") {
    console.log("[AI] No repomixSummary provided → running generateRAGReport inline (4-query RAG)");
    const { generateRAGReport } = require("./ragQuery.service.js");
    ragSummary = await generateRAGReport(projectId, projectLabel);
    console.log("[AI] Inline RAG complete — proceeding with code-only report");
  } else {
    console.log("[AI] Using pre-computed repomixSummary from caller");
  }

  // ── Build code evidence context ─────────────────────────────────────────────
  const codeQuality     = ragSummary.code_quality_score ?? 50;
  const techDebtEstimate = Math.round((100 - codeQuality) * 0.8);

  const moduleList = Array.isArray(ragSummary.modules)
    ? ragSummary.modules.slice(0, 6).map((m) => `  - ${m.name}: ${m.purpose}`).join("\n")
    : "  No module data.";

  const riskList = Array.isArray(ragSummary.risks)
    ? ragSummary.risks.slice(0, 5).map((r) =>
        `  [${(r.severity || "?").toUpperCase()}] ${r.name} [file: ${r.file || "?"}]: ${r.description}`
      ).join("\n")
    : "  None detected.";

  const improvList = Array.isArray(ragSummary.improvements)
    ? ragSummary.improvements.slice(0, 5).map((i) =>
        `  - [${i.impact}] ${i.title} [file: ${i.file || "?"}]: ${i.description}`
      ).join("\n")
    : "  None detected.";

  const issueRows = Array.isArray(ragSummary.code_issues)
    ? ragSummary.code_issues.slice(0, 8).map((ci) =>
        `  - [${ci.type}] [${ci.file}] ${ci.title}: ${ci.behavior}`
      ).join("\n")
    : "  None detected.";

  // ── LLM CALL 1: Code Analysis (issues / risks / suggestions / trend) ──────────
  const techStack  = Array.isArray(ragSummary.tech_stack) ? ragSummary.tech_stack.join(", ") : "unknown";
  const codePrompt = `Software engineer analyzing "${projectLabel}". Stack: ${techStack}. Quality: ${codeQuality}/100.
Architecture: ${ragSummary.architecture || "N/A"}
Overview: ${ragSummary.overview || "N/A"}
Modules: ${moduleList}
Risks: ${riskList}
Issues: ${issueRows}
Improvements: ${improvList}

Rules: cite exact files. No generic phrases. Evidence only. CRITICAL: Every item across Issues, Suggestions, and Risks MUST be completely unique. Do not repeat the same point twice.
Return ONLY this JSON:
{"issues_data":{"issues_found":[{"title":"file+behavior","severity":"high|medium|low","description":"<=60 chars"}],"issue_patterns":["string"],"most_critical_issue":"string","estimated_tech_debt_days":${techDebtEstimate}},"trend_data":{"trend_direction":"improving|declining|stable","trend_summary":"<=80 chars","key_inflection_points":["string"],"velocity_assessment":"string"},"suggestions_data":{"suggestions":[{"title":"file-backed action","action":"concrete step","impact":"high|medium|low","effort":"low|medium|high","category":"code_quality|process|testing"}],"quick_wins":["unique string"],"top_priority":"unique string"},"risk_data":{"risk_level":"critical|high|medium|low","risks":[{"name":"risk+file","likelihood":"high|medium|low","impact":"high|medium|low","description":"file-backed"}],"bus_factor_risk":"high|medium|low","abandonment_probability":"high|medium|low","recommended_actions":["unique string"]}}
Max: 4 issues, 3 suggestions, 3 risks. CRITICAL: If there are no issues or risks in the context above, return empty arrays. DO NOT invent or hallucinate files.`;

  console.log("[AI] Call 1: Code analysis...");
  const codeResult = await callLLM(codePrompt, 800, true);

  // ── LLM CALL 2: Tech Trends + Future Score ────────────────────────────────────
  const trendPrompt = `Tech strategist analyzing "${projectLabel}" (${techStack}). Current quality: ${codeQuality}/100.
Project overview: ${ragSummary.overview || "N/A"}
Key issues: ${issueRows || "None detected"}

Using your 2025 technology knowledge, identify trending technologies DIRECTLY relevant to this project's stack and domain. For each tech, explain EXACTLY how it connects to THIS project's ${techStack} stack.

Return ONLY this JSON:
{"tech_trend_data":{"project_domain":"one-line description of what this project does","trending_technologies":[{"name":"tech name","category":"AI|DevOps|Frontend|Backend|Database|Security|Testing|Other","trend_status":"hot|rising|stable|declining","relevance_to_project":"explain EXACTLY how this applies to this project's ${techStack} stack and use case","why_trending":"concise 2025 reason","free_tier":true,"free_tier_details":"what is free","url":"https://..."}],"technology_radar":{"adopt":["tech from current stack to keep"],"trial":["emerging tech to experiment with"],"assess":["tech to watch"],"hold":["outdated tech in stack"]},"market_insights":["insight specific to this project's domain"],"trending_repos":[{"name":"EXISTING real open-source repo (e.g. facebook/react)","url":"https://github.com/...","why_relevant":"one line relevance to this project"}]},"future_score_data":{"prediction_confidence":"medium","key_factors":["factor that will most affect the score"],"improvement_roadmap":[{"milestone":"specific achievable goal","timeframe":"1 month","expected_score_gain":3},{"milestone":"specific achievable goal","timeframe":"3 months","expected_score_gain":5}],"risk_to_prediction":"main risk to improvement"}}
Max: 4 trending techs, 2 repos. Fill ALL fields with specific, non-generic values.`;

  console.log("[AI] Call 2: Tech trends + future score...");
  const trendResult = await callLLM(trendPrompt, 800, true);
  console.log("[AI] Both LLM calls complete.");

  return {
    project_id:        project._id || project.id,
    snapshot_id:       snapshot ? (snapshot._id || snapshot.id) : null,
    generated_at:      new Date(),
    code_quality_score: codeQuality,
    issues_data:       codeResult?.issues_data       || { issues_found: [] },
    trend_data:        codeResult?.trend_data        || { trend_direction: "stable", trend_summary: "Code quality analysis complete." },
    tech_trend_data:   trendResult?.tech_trend_data  || { project_domain: "", trending_technologies: [], technology_radar: {}, market_insights: [], trending_repos: [] },
    future_score_data: {
      ...(trendResult?.future_score_data || {}),
      predicted_score_next_month: Math.max(0, codeQuality - 2),
      predicted_score_3_months:   Math.max(0, codeQuality - 7),
      predicted_score_6_months:   Math.max(0, codeQuality - 15),
    },
    suggestions_data:  codeResult?.suggestions_data  || { suggestions: [] },
    risk_data:         codeResult?.risk_data         || { risks: [] },
  };
}

module.exports = {
  indexRepositoryContext,
  queryRAGContext,
  generateFullAIReport,
};



