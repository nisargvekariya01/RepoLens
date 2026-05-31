/**
 * repomixAnalysis.service.js
 *
 * Hierarchical summarization pipeline for Repomix-chunked repository output.
 *
 * Stage 1 — Sequential Chunk Summaries (rate-limit safe):
 *   For each text chunk, call the LLM with a focused "summarize this code" prompt.
 *   Results are compact text summaries (~300 tokens each).
 *   Concurrency = 1 + 300ms inter-call delay to stay within Groq 6000 TPM.
 *
 * Stage 2 — Aggregate Summary:
 *   Feed all chunk summaries (NOT raw code) into a single aggregate LLM call.
 *   Produces the final structured JSON:
 *   { overview, architecture, modules, data_flow, risks, improvements }
 *
 * Token budget per chunk (Groq llama-3.1-8b-instant, 6000 TPM):
 *   Input  ≤ 4500 tokens  (≤ ~18 000 chars)
 *   Output ≤  800 tokens
 *   Total  ≤ 5 300 tokens per call
 */

const { callLLM } = require("./llm.service");

const { minifyCodeChunk } = require("./aiContext.builder");

// ─── Config ───────────────────────────────────────────────────────────────────

// Hard-cap chars sent to LLM per batch (Groq handles up to 3000 tokens easily with 12000 chars)
const MAX_BATCH_PROMPT_CHARS = 12000;

// Sequential concurrency by default — Groq 6000 TPM requires conservative pacing
const REPOMIX_CONCURRENCY = Math.max(
  1,
  parseInt(process.env.REPOMIX_CONCURRENCY || "1", 10)
);

// Inter-call delay in ms 
const CALL_DELAY_MS = parseInt(process.env.REPOMIX_CALL_DELAY_MS || "150", 10);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Lightweight p-limit implementation (avoids adding a dependency).
 */
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

// ─── Stage 1: Batch-Chunk Summarization ────────────────────────────────────────

/**
 * Build the prompt for summarizing a BATCH of chunks (up to 5).
 * Forces < 50 tokens array output.
 */
function buildBatchSummaryPrompt(batchChunks, batchStartIndex, totalChunks, projectName) {
  let combinedText = "";
  batchChunks.forEach((c, idx) => {
    const chunkNum = batchStartIndex + idx + 1;
    let text = c.text || "";
    let estimatedTokens = Math.round(text.length / 4);

    // 2. Enforce Token Limit Per Chunk
    if (estimatedTokens > 1500) {
      console.warn(`[AI] Chunk ${chunkNum} estimated at ${estimatedTokens} tokens (> 1500). Applying splitChunk truncation...`);
      // function splitChunk equivalent logic inside a prompt builder context:
      text = text.slice(0, 6000); 
    }

    combinedText += `\n--- CHUNK ${chunkNum} ---\n${minifyCodeChunk(text)}`;
  });
  
  const safeText = combinedText.slice(0, MAX_BATCH_PROMPT_CHARS);

  return `You are a strict code analyzer for the "${projectName}" repository.
We are processing ${batchChunks.length} chunks (Chunks ${batchStartIndex + 1} to ${batchStartIndex + batchChunks.length} of ${totalChunks}).

${safeText}

Provide a JSON array of CONCISE objects for each chunk.
CRITICAL RULE: Keep each summary under 50 words! Ignore trivial boilerplates.

Return EXACTLY this JSON array format (and nothing else!):
[
  {
    "chunk_number": 1,
    "summary": "1-2 short sentences about primary responsibilities and structural content."
  }
]`;
}

/**
 * Summarize a batch of chunks (up to 5) using the LLM.
 */
async function summarizeBatch(batchChunks, batchStartIndex, totalChunks, projectName) {
  try {
    const prompt = buildBatchSummaryPrompt(
      batchChunks,
      batchStartIndex, totalChunks, projectName
    );

    let totalTokens = Math.round(prompt.length / 4);

    // 6. Validate Before LLM Call
    if (totalTokens > 5000) {
      console.warn(`[AI] Token limit exceeded (${totalTokens} > 5000). Forcing truncation...`);
      // reduce chunks logic (fail-safe hard trim)
      const reducedPrompt = prompt.slice(0, 20000); // hard cap at 5000 tokens
      totalTokens = 5000;
    }

    // 7. Logging
    batchChunks.forEach((c, idx) => {
      console.log(`[AI] Tokens per chunk: ${Math.round((c.charCount || c.text?.length || 0) / 4)} (Chunk ${batchStartIndex + idx + 1})`);
    });
    console.log(`[AI] Total tokens per request: ${totalTokens}`);

    console.log(
      `[RepomixAnalysis] Summarizing batch of ${batchChunks.length} chunks (Starting at ${batchStartIndex + 1}/${totalChunks})`
    );

    // Expecting structured JSON array mapping to chunks
    const result = await callLLM(totalTokens === 5000 ? prompt.slice(0, 20000) : prompt, 800, true);

    if (!result || !Array.isArray(result)) {
      console.warn(`[RepomixAnalysis] Batch starting at ${batchStartIndex + 1} returned invalid JSON structure.`);
      return null;
    }

    return result.map((item, id) => {
        const localIdx = item.chunk_number - (batchStartIndex + 1);
        const mappedChunk = batchChunks[localIdx] || batchChunks[id]; // Best effort mapping
        return {
          chunkIndex: batchStartIndex + id,
          filePaths: mappedChunk ? mappedChunk.filePaths : [],
          summary: item.summary || "No specific summary generated.",
        };
    });
  } catch (err) {
    console.error(
      `[RepomixAnalysis] Batch starting at ${batchStartIndex + 1} summarization failed:`,
      err.message
    );
    return null;
  }
}
/**
 * Run sequential chunk summarization in batches of 5 with rate-limit safe delay.
 * Returns array of { chunkIndex, filePaths, summary } objects (nulls filtered out).
 */
async function summarizeAllChunks(chunks, projectName, onProgress = null) {
  const limit = pLimit(REPOMIX_CONCURRENCY);
  const total = chunks.length;
  const BATCH_SIZE = 5;
  const MAX_DEEP_ANALYZE = 30; // Deep analysis (top 20-40 chunks) limit

  console.log(`\n[AI] Generating batch summaries for top ${Math.min(total, MAX_DEEP_ANALYZE)} chunks (Batch Size: ${BATCH_SIZE})...`);
  console.log(`[RepomixAnalysis] Concurrency=${REPOMIX_CONCURRENCY}, delay=${CALL_DELAY_MS}ms between calls`);

  let completedBatches = 0;
  const deepChunks = chunks.slice(0, Math.min(total, MAX_DEEP_ANALYZE));
  const lightChunks = chunks.slice(MAX_DEEP_ANALYZE);
  const totalBatches = Math.ceil(deepChunks.length / BATCH_SIZE);
  let results = [];

  // Deep Analysis (Top Priority Dirs)
  for (let i = 0; i < deepChunks.length; i += BATCH_SIZE) {
    const batchChunks = deepChunks.slice(i, i + BATCH_SIZE);

    const batchResults = await limit(async () => {
      const r = await summarizeBatch(batchChunks, i, deepChunks.length, projectName);

      // Rate-limit safe delay between every call
      if (i + BATCH_SIZE < deepChunks.length) {
        console.log(`[AI] Rate limit delay applied (${CALL_DELAY_MS}ms)`);
        await sleep(CALL_DELAY_MS);
      }

      return r;
    });

    completedBatches++;
    const pct = Math.round((completedBatches / Math.max(totalBatches, 1)) * 60); 
    if (onProgress) await onProgress(pct, `Deep analyzing batch ${completedBatches}/${totalBatches}`);

    if (batchResults && Array.isArray(batchResults)) {
      results = results.concat(batchResults);
    }
  }

  // Light Scan (Remaining without LLM calls)
  if (lightChunks.length > 0) {
    console.log(`[AI] Applying light scan (bypassing LLM) to remaining ${lightChunks.length} chunks...`);
    lightChunks.forEach((c, idx) => {
      results.push({
        chunkIndex: MAX_DEEP_ANALYZE + idx,
        filePaths: c.filePaths,
        summary: `Lightweight Metadata Scan: Contains supplementary structural elements or minor configurations: ${c.filePaths.slice(0, 3).join(", ")}${c.filePaths.length > 3 ? ` +${c.filePaths.length - 3} more` : ""}`
      });
    });
  }

  const chunkSummaries = results
    .filter((r) => r !== null)
    .sort((a, b) => a.chunkIndex - b.chunkIndex);

  console.log(
    `[RepomixAnalysis] Analysis complete: Deep=${deepChunks.length}, Light=${lightChunks.length} chunks.`
  );

  return chunkSummaries;
}

// ─── Stage 2: Aggregate Summary ───────────────────────────────────────────────

/**
 * Build the aggregate prompt from all chunk summaries.
 * Keeps total input ≤ 4000 tokens by truncating the summaries block if needed.
 */
function buildAggregatePrompt(chunkSummaries, projectTree, projectName, repoContext) {
  const summaryText = chunkSummaries
    .map(
      (cs, i) =>
        `--- Section ${i + 1} (${cs.filePaths.slice(0, 3).join(", ")}${cs.filePaths.length > 3 ? ` +${cs.filePaths.length - 3} more` : ""}) ---\n${cs.summary}`
    )
    .join("\n\n");

  const treeSection = projectTree
    ? `=== PROJECT STRUCTURE ===\n${projectTree.slice(0, 1000)}\n\n`
    : "";

  const contextSection = repoContext
    ? `=== REPOSITORY METADATA ===\n${repoContext}\n\n`
    : "";

  // Keep the summaries block ≤ 12 000 chars (≈ 3000 tokens) to leave room for prompt + output
  const safeSummaries = summaryText.slice(0, 12000);

  return `${contextSection}${treeSection}=== CODEBASE ANALYSIS SUMMARIES (${chunkSummaries.length} sections) ===

${safeSummaries}

You are a principal software architect producing a definitive repository analysis report for "${projectName}".

Based ONLY on the summaries above, return EXACTLY this JSON (nothing else):
{
  "overview": "2-3 sentences describing what this project does and its tech stack",
  "architecture": "3-5 sentences describing the architectural patterns, layers, and major design decisions",
  "data_flow": "1-2 sentences describing how data moves through the system",
  "modules": [
    {
      "name": "module name",
      "purpose": "what it does in 1-2 sentences",
      "files": ["key file paths (max 3)"],
      "complexity": "low|medium|high"
    }
  ],
  "risks": [
    {
      "name": "risk name",
      "severity": "critical|high|medium|low",
      "description": "concise risk description max 100 chars",
      "affected_areas": ["file or module names"]
    }
  ],
  "improvements": [
    {
      "title": "improvement title",
      "impact": "high|medium|low",
      "effort": "low|medium|high",
      "description": "specific actionable recommendation max 120 chars",
      "category": "performance|security|maintainability|testing|architecture"
    }
  ],
  "tech_stack": ["list of detected frameworks/libraries/languages"],
  "code_quality_score": 0
}
Rules:
- modules: max 8, sorted by importance
- risks: max 5, sorted by severity
- improvements: max 5, highest impact first
- code_quality_score: integer 0-100
Return ONLY the JSON object.`;
}

/**
 * Run the aggregate LLM call to produce the final structured repo analysis.
 */
async function aggregateSummaries(chunkSummaries, projectTree, projectName, repoContext) {
  console.log(
    `[AI] Aggregating final report from ${chunkSummaries.length} chunk summaries...`
  );

  if (chunkSummaries.length === 0) {
    throw new Error("[RepomixAnalysis] No chunk summaries to aggregate");
  }

  const prompt = buildAggregatePrompt(chunkSummaries, projectTree, projectName, repoContext);

  const result = await callLLM(prompt, 1200, true);

  if (!result || typeof result !== "object") {
    throw new Error("[RepomixAnalysis] Aggregate call returned invalid JSON");
  }

  // Normalize and validate the result structure
  return {
    overview: result.overview || "Repository analysis completed.",
    architecture: result.architecture || "Architecture details not available.",
    data_flow: result.data_flow || "",
    modules: Array.isArray(result.modules) ? result.modules.slice(0, 8) : [],
    risks: Array.isArray(result.risks) ? result.risks.slice(0, 5) : [],
    improvements: Array.isArray(result.improvements) ? result.improvements.slice(0, 5) : [],
    tech_stack: Array.isArray(result.tech_stack) ? result.tech_stack : [],
    code_quality_score:
      typeof result.code_quality_score === "number"
        ? Math.min(100, Math.max(0, result.code_quality_score))
        : 50,
  };
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

/**
 * Full hierarchical analysis pipeline for a Repomix-processed repository.
 *
 * @param {Array}    chunks       - Output from repomix.service.js (chunks array)
 * @param {string}   projectTree  - ASCII project structure tree
 * @param {string}   projectName  - Human-readable project name
 * @param {string}   repoContext  - Optional pre-built context string
 * @param {Function} onProgress   - Optional async callback(percent, message)
 *
 * @returns {Object} Structured repo analysis JSON
 */
async function analyzeWithRepomix(chunks, projectTree, projectName, repoContext = "", onProgress = null) {
  console.log(`\n[RepomixAnalysis] ═══ START Pipeline for "${projectName}" ═══`);
  console.log(`[AI] Chunk count: ${chunks.length}`);

  // ── Stage 1: Sequential chunk summaries ────────────────────────────────────
  if (onProgress) await onProgress(5, "Starting code analysis...");

  const chunkSummaries = await summarizeAllChunks(chunks, projectName, onProgress);

  // ── Stage 2: Aggregate ────────────────────────────────────────────────────
  if (onProgress) await onProgress(65, "Aggregating code insights...");

  const structuredReport = await aggregateSummaries(
    chunkSummaries,
    projectTree,
    projectName,
    repoContext
  );

  if (onProgress) await onProgress(95, "Finalizing repository report...");

  console.log(`[AI] Repo analysis completed.`);
  console.log(`[RepomixAnalysis] ═══ Pipeline COMPLETE for "${projectName}" ═══\n`);

  return {
    ...structuredReport,
    chunk_count: chunks.length,
    summaries_generated: chunkSummaries.length,
    analysis_method: "repomix",
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  analyzeWithRepomix,
  summarizeAllChunks,
  aggregateSummaries,
};
