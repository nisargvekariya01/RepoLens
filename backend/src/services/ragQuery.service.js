/**
 * ragQuery.service.js  — Code Intelligence Engine v3
 *
 * FINAL implementation. Zero GitHub data. Zero legacy mode.
 *
 * Pipeline (generateRAGReport):
 *   4 focused queries (bugs / architecture / performance / code_smells)
 *   → Qdrant: project_id + priority:high/medium + must_not noise files
 *   → Code extension whitelist filter (.ts .js .tsx .jsx .c .cpp .h .py .go .rs)
 *   → Per-query diversity: max 2 chunks per file
 *   → Global merge: dedup by contentHash, query balancing, global cap
 *   → Pre-LLM validation: abort if GitHub keywords detected OR < 5 unique files
 *   → Single LLM call with strict anti-hallucination prompt (code-only)
 *   → Post-filter: remove any item without file evidence
 *   → Structured logging: { mode, queries_executed, topK, ... }
 *
 * Pipeline (queryWithRAG — copilot Q&A):
 *   Same 2-stage filter + noise rejection
 */

const { callLLM }                           = require("./llm.service");
const { generateEmbedding }                 = require("./embedding.service");
const { initCollection, searchSimilarChunks } = require("./vectorStore.service");
const { estimateTokens, isNoiseFile }       = require("../utils/chunkCode.utils");
const crypto                                = require("crypto");

const COLLECTION_NAME = "codebase_index";
const MODE = "code_analysis"; // ALWAYS — no legacy mode

// ─── Constants ────────────────────────────────────────────────────────────────

const TOP_K_PER_QUERY           = parseInt(process.env.RAG_TOP_K_PER_QUERY   || "4", 10);
const MAX_CHUNKS_FINAL          = parseInt(process.env.RAG_MAX_CHUNKS_FINAL  || "6", 10);
const MAX_CONTEXT_CHARS         = parseInt(process.env.RAG_MAX_CONTEXT_CHARS || "7000", 10);
const MAX_CHUNK_CHARS_EACH      = 500;   // hard cap per chunk after minification
const MAX_CHUNKS_PER_FILE_PER_QUERY = 1;
const MAX_CHUNKS_PER_FILE_GLOBAL    = 2;
const MIN_UNIQUE_FILES_REQUIRED     = 1;   // lowered to 1 to support tiny repos
const SINGLE_QUERY_TOP_K        = parseInt(process.env.RAG_TOP_K || "4", 10);
const MAX_CHUNK_CHARS           = 800;   // per-chunk display cap in copilot Q&A
const PROMPT_TOKEN_HARD_LIMIT   = 4200;  // tokens — Groq 6000 TPM, leave ~1800 for output

// ─── Code File Extension Whitelist ───────────────────────────────────────────

/**
 * Only files with these extensions are allowed into the RAG context.
 * Everything else (README, .env, .yaml, .json non-config, SQL, CSS...) is excluded.
 */
const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",   // JavaScript / TypeScript
  ".c", ".h", ".cpp", ".cc", ".hpp",              // C / C++
  ".py",                                           // Python
  ".go",                                           // Go
  ".rs",                                           // Rust
  ".java",                                         // Java
  ".kt",                                           // Kotlin
  ".swift",                                        // Swift
  ".rb",                                           // Ruby
  ".php",                                          // PHP
  ".cs",                                           // C#
  ".scala",                                        // Scala
  ".sh", ".bash",                                  // Shell (logic-bearing scripts)
]);

/**
 * Returns true if the file path has a whitelisted code extension.
 */
function isCodeFile(filePath) {
  if (!filePath) return false;
  const dot = filePath.lastIndexOf(".");
  if (dot === -1) return false;
  return CODE_EXTENSIONS.has(filePath.slice(dot).toLowerCase());
}

// ─── Qdrant Filters ───────────────────────────────────────────────────────────

/**
 * Specific noisy file names / patterns to exclude at Qdrant level.
 * Qdrant can't do wildcard matching, but we can exclude known file names exactly.
 */
const EXACT_NOISE_FILES = [
  "README.md", "readme.md", "README.MD",
  ".env", ".env.example", ".env.local", ".env.production",
  ".gitignore", ".npmignore", ".dockerignore",
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
  "CHANGELOG.md", "LICENSE", "CONTRIBUTING.md",
];

/**
 * Primary Qdrant filter: project_id + priority in [high, medium] + must_not noisy files.
 */
function buildCodeFilter(projectId) {
  return {
    must: [
      { key: "project_id", match: { value: projectId.toString() } },
      { key: "priority",   match: { any: ["high", "medium"] } },
    ],
    must_not: EXACT_NOISE_FILES.map((name) => ({
      key: "file_path", match: { value: name }
    })),
  };
}

/** Fallback: project-only (no priority, no must_not — for old un-prioritized data). */
function buildProjectFilter(projectId) {
  return {
    must: [{ key: "project_id", match: { value: projectId.toString() } }],
  };
}

/**
 * Post-retrieval path filter.
 * Qdrant can't do pattern matching — this catches .github/, docs/, .cursor/, etc.
 * Also enforces the code-extension whitelist.
 */
function rejectNonCodeResults(results) {
  return results.filter((r) => {
    const fp = r.payload?.file_path || r.filePath || "";
    if (isNoiseFile(fp)) return false;
    if (!isCodeFile(fp))  return false;
    return true;
  });
}

// ─── 4 Analysis Queries ───────────────────────────────────────────────────────

const ANALYSIS_QUERIES = [
  {
    id:   "bugs",
    text: "Find bugs, null pointer exceptions, unhandled promise rejections, missing try-catch, " +
          "undefined variable access, incorrect conditionals, runtime crashes, off-by-one errors, type mismatches",
  },
  {
    id:   "architecture",
    text: "Identify architecture problems, circular dependencies, god objects, tightly coupled modules, " +
          "poor separation of concerns, missing abstractions, monolithic functions, violating single responsibility",
  },
  {
    id:   "performance",
    text: "Find performance bottlenecks, N+1 database queries, synchronous blocking in async code, " +
          "memory leaks, unbounded loops, large payload processing, missing pagination, inefficient algorithms",
  },
  {
    id:   "code_smells",
    text: "Detect code smells, duplicated logic, magic numbers, dead code, overly complex functions, " +
          "missing error handling, hardcoded secrets, inconsistent naming, deep nesting, callback hell",
  },
];

// ─── Single Query Retrieval ───────────────────────────────────────────────────

/**
 * Retrieve topK chunks for ONE query with full filter stack:
 *   1. Qdrant: code filter (priority + must_not)
 *   2. Fallback to project-only if < 1 result (old data)
 *   3. rejectNonCodeResults (path pattern + extension whitelist)
 *   4. Per-query diversity: max 2 chunks per file
 *
 * Returns enriched chunk objects with enough metadata for merge step.
 */
async function retrieveForQuery(projectId, queryText, queryId, topK = TOP_K_PER_QUERY) {
  const queryVector = await generateEmbedding(queryText);
  if (!queryVector || !Array.isArray(queryVector)) {
    console.warn(`[RAG:Q:${queryId}] ⚠️  Embedding failed`);
    return [];
  }

  // ── Stage 1: Qdrant with code filter ──────────────────────────────────────
  let raw = await searchSimilarChunks(COLLECTION_NAME, queryVector, topK, buildCodeFilter(projectId));
  let usedFallback = false;

  if (!raw || raw.length === 0) {
    console.warn(`[RAG:Q:${queryId}] 0 results with code filter → falling back to project-only (re-index recommended)`);
    raw = await searchSimilarChunks(COLLECTION_NAME, queryVector, topK, buildProjectFilter(projectId));
    usedFallback = true;
  }

  if (!raw || raw.length === 0) return [];

  // ── Stage 2: Post-retrieval code-file filter ───────────────────────────────
  const codeOnly = rejectNonCodeResults(raw);
  const filteredOut = raw.length - codeOnly.length;
  if (filteredOut > 0) {
    console.log(`[RAG:Q:${queryId}] Removed ${filteredOut} non-code files (README/.env/.github/docs)`);
  }

  // ── Stage 3: Per-query diversity (max 2 chunks per file) ──────────────────
  const fileCount = {};
  const diverse   = [];
  for (const r of codeOnly) {
    const fp = r.payload?.file_path || "unknown";
    fileCount[fp] = (fileCount[fp] || 0);
    if (fileCount[fp] < MAX_CHUNKS_PER_FILE_PER_QUERY) {
      const content     = r.payload?.content || "";
      const contentHash = crypto.createHash("md5").update(content).digest("hex");
      diverse.push({
        queryId,
        filePath:    fp,
        content,
        score:       r.score || 0,
        contentHash,
        priority:    r.payload?.priority    || "medium",
        language:    r.payload?.language    || "unknown",
        chunkIndex:  r.payload?.chunk_index ?? 0,
        chunkTokens: r.payload?.chunk_tokens || estimateTokens(content),
      });
      fileCount[fp]++;
    }
  }

  const uniqueFileCount = Object.keys(fileCount).filter((k) => fileCount[k] > 0).length;
  console.log(
    `[RAG:Q:${queryId}] raw=${raw.length} → code-filtered=${codeOnly.length}` +
    ` → diversity=${diverse.length} from ${uniqueFileCount} files` +
    (usedFallback ? " [FALLBACK]" : "")
  );
  return diverse;
}

// ─── Merge & Deduplicate ──────────────────────────────────────────────────────

/**
 * Merge per-query results:
 *   1. Deduplicate by contentHash (keep highest score)
 *   2. Query balancing: ≥ 1 chunk per query
 *   3. Global diversity: max MAX_CHUNKS_PER_FILE_GLOBAL per file
 *   4. Cap at MAX_CHUNKS_FINAL
 */
function mergeAndDeduplicate(queryResults) {
  // Dedup by hash
  const seen = new Map();
  for (const results of queryResults) {
    for (const chunk of results) {
      const existing = seen.get(chunk.contentHash);
      if (!existing || chunk.score > existing.score) {
        seen.set(chunk.contentHash, { ...chunk });
      }
    }
  }
  const deduped = Array.from(seen.values());
  deduped.sort((a, b) => b.score - a.score);

  // Query balancing: one guaranteed slot per query
  const queryReps      = new Set();
  const guaranteed     = [];
  const guaranteedHashes = new Set();
  for (const chunk of deduped) {
    if (!queryReps.has(chunk.queryId)) {
      guaranteed.push(chunk);
      guaranteedHashes.add(chunk.contentHash);
      queryReps.add(chunk.queryId);
    }
  }

  // Fill remaining slots (global diversity)
  const fileCount = {};
  for (const c of guaranteed) fileCount[c.filePath] = (fileCount[c.filePath] || 0) + 1;

  const final = [...guaranteed];
  for (const chunk of deduped) {
    if (final.length >= MAX_CHUNKS_FINAL) break;
    if (guaranteedHashes.has(chunk.contentHash)) continue;
    const fc = fileCount[chunk.filePath] || 0;
    if (fc >= MAX_CHUNKS_PER_FILE_GLOBAL) continue;
    final.push(chunk);
    fileCount[chunk.filePath] = fc + 1;
  }

  final.sort((a, b) => b.score - a.score);

  const stats = {
    totalRaw:    queryResults.reduce((s, r) => s + r.length, 0),
    afterDedup:  deduped.length,
    afterMerge:  final.length,
    uniqueFiles: [...new Set(final.map((c) => c.filePath))].length,
    queryContributions: ANALYSIS_QUERIES.map((q) => ({
      queryId: q.id,
      count:   final.filter((c) => c.queryId === q.id).length,
    })),
  };

  return { chunks: final, stats };
}

// ─── Chunk Minification ──────────────────────────────────────────────────────

/**
 * Aggressively minify a code chunk to reduce token usage:
 * - Remove blank lines and pure comment lines
 * - Collapse repeated whitespace
 * - Truncate to MAX_CHUNK_CHARS_EACH
 */
function minifyChunk(text) {
  return text
    .split("\n")
    .filter(line => {
      const t = line.trim();
      if (!t) return false;                         // empty lines
      if (/^\/\//.test(t)) return false;            // single-line comments
      if (/^\/\*/.test(t) || /^\*/.test(t)) return false; // block comments
      return true;
    })
    .map(l => l.replace(/\s+/g, " ").trimEnd())    // collapse whitespace
    .join("\n")
    .slice(0, MAX_CHUNK_CHARS_EACH);
}

// ─── Context Formatting ───────────────────────────────────────────────────────

function formatContextBlocks(chunks) {
  const byFile = new Map();
  for (const c of chunks) {
    if (!byFile.has(c.filePath)) byFile.set(c.filePath, []);
    byFile.get(c.filePath).push(c);
  }

  const sortedFiles = [...byFile.entries()].sort(([, a], [, b]) => {
    const pa = a[0].priority === "high" ? 0 : 1;
    const pb = b[0].priority === "high" ? 0 : 1;
    return pa !== pb ? pa - pb : b[0].score - a[0].score;
  });

  const parts = [];
  for (const [fp, fileChunks] of sortedFiles) {
    const body = fileChunks
      .map(c => minifyChunk(c.content))
      .filter(Boolean)
      .join("\n// ---\n");
    if (body) parts.push(`=== ${fp} ===\n${body}`);
  }

  let block = parts.join("\n\n");

  if (block.length > MAX_CONTEXT_CHARS) {
    console.warn(`[RAG:Context] Over limit (${block.length} chars) — hard truncating`);
    block = block.substring(0, MAX_CONTEXT_CHARS) + "\n...[TRUNCATED]";
  }

  const filesContributing = [...byFile.keys()];
  const totalTokens       = estimateTokens(block);
  console.log(`[RAG] Context: ${block.length} chars, ~${totalTokens} tokens, ${filesContributing.length} files`);
  return { contextBlock: block, filesContributing, totalTokens };
}

// ─── Pre-LLM Validation ───────────────────────────────────────────────────────

/**
 * Abort if GitHub data leaked into context (fail-safe checkpoint).
 * Returns { valid: boolean, reason: string }
 */
function validateContext(contextBlock, uniqueFiles) {
  // Check for GitHub-data keywords
  const FORBIDDEN = ["RECENT ISSUES", "RECENT COMMITS", "COMMITS", "PULL REQUESTS", "health score"];
  for (const kw of FORBIDDEN) {
    if (contextBlock.toUpperCase().includes(kw.toUpperCase())) {
      return { valid: false, reason: `GitHub data keyword detected: "${kw}"` };
    }
  }
  // Check minimum unique code files
  if (uniqueFiles < MIN_UNIQUE_FILES_REQUIRED) {
    return { valid: false, reason: `Only ${uniqueFiles} unique code files (minimum ${MIN_UNIQUE_FILES_REQUIRED} required)` };
  }
  return { valid: true, reason: "" };
}

// ─── Zero-Hallucination System Prompt ────────────────────────────────────────

/**
 * Generates the evidence-only RAG system prompt.
 *
 * Key additions over the previous version:
 *   - FORBIDDEN PHRASES list (matched by postFilterInsights too)
 *   - VALID ISSUE CRITERIA (only clearly observable patterns count)
 *   - `proof` field required alongside `behavior` in every code_issue
 *   - `validations` block required in output for evidence accountability
 */
function buildStrictPrompt(contextBlock, projectName, filesContributing) {
  const fileList = filesContributing.slice(0, 10).join(", ");
  return `Code review of "${projectName}". Files: ${fileList}

RULES:
1. Use ONLY the source code below. No GitHub data.
2. Every finding MUST have a real file path from the code.
3. No vague phrases: "may cause", "consider using", "add tests".
4. If no clear evidence exists, return empty array.
5. Only report: null deref, unawaited promise, memory leak, bad conditional, N+1 query, hardcoded secret.

CODE:
${contextBlock}

Return ONLY this JSON:
{"overview":"","architecture":"","modules":[{"name":"","purpose":"","complexity":"low|medium|high"}],"risks":[{"name":"","severity":"high|medium|low","description":"","file":"","proof":""}],"improvements":[{"title":"","impact":"high|medium|low","description":"","file":"","proof":""}],"code_issues":[{"type":"bug|performance|architecture|code_smell","title":"","file":"","behavior":"","proof":"","impact":""}],"tech_stack":[],"code_quality_score":0,"validations":{"issues_with_proof":0,"rejected_due_to_no_evidence":0}}
LIMITS: modules<=5, risks<=4, improvements<=4, code_issues<=6. Return ONLY valid JSON.`;
}


// ─── Post-Processing ──────────────────────────────────────────────────────────

/**
 * Forbidden vague phrases that indicate hallucinated / generic output.
 * Matched against behavior, proof, description, and title fields.
 */
const FORBIDDEN_PHRASES = [
  /may cause/i,
  /could lead to/i,
  /potential issue/i,
  /likely problem/i,
  /optimize performance/i,
  /improve code quality/i,
  /add error handling/i,
  /consider using/i,
  /refactor code/i,
  /add tests/i,
  /follow best practices/i,
  /ensure (error|proper|better)/i,
];

/** Original generic-pattern list (start-of-sentence heuristics) */
const GENERIC_PATTERNS = [
  /^improve (code quality|error handling|performance|readability)/i,
  /^add (tests|unit tests|documentation|logging)/i,
  /^consider (refactoring|using|implementing)/i,
  /^ensure (code quality|best practices|consistency)/i,
  /^follow (best practices|coding standards|conventions)/i,
  /^implement (proper|better|more) (error handling|testing|validation)/i,
  /^refactor (code|the|this)/i,
];

function hasFileRef(item) {
  const f = item?.file || "";
  return f && f !== "" && f !== "unknown" && f !== "N/A" && f !== "exact/path/to/file.ts";
}

function hasProof(item) {
  // Accept either `proof` OR a substantive `behavior` (≥ 15 chars)
  const proof    = (item?.proof    || "").trim();
  const behavior = (item?.behavior || "").trim();
  return proof.length >= 10 || behavior.length >= 15;
}

function hasForbiddenPhrase(item) {
  const text = [
    item?.behavior || "",
    item?.proof    || "",
    item?.description || "",
    item?.title    || "",
  ].join(" ");
  return FORBIDDEN_PHRASES.some((p) => p.test(text)) ||
         GENERIC_PATTERNS.some((p) => p.test(text.trim()));
}

/**
 * Remove items without file references, insufficient proof, or forbidden vague phrases.
 * Tracks rejected_due_to_no_evidence for the validations block.
 */
function postFilterInsights(ragResult) {
  if (!ragResult || typeof ragResult !== "object") return ragResult;

  let removed_risks        = 0;
  let removed_improvements = 0;
  let removed_issues       = 0;

  if (Array.isArray(ragResult.risks)) {
    const before = ragResult.risks.length;
    ragResult.risks = ragResult.risks.filter((r) => {
      if (!hasFileRef(r))        return false; // no file
      if (hasForbiddenPhrase(r)) return false; // vague phrasing
      return true;
    });
    removed_risks = before - ragResult.risks.length;
  }

  if (Array.isArray(ragResult.improvements)) {
    const before = ragResult.improvements.length;
    ragResult.improvements = ragResult.improvements.filter((i) => {
      if (!hasFileRef(i))        return false;
      if (hasForbiddenPhrase(i)) return false;
      return true;
    });
    removed_improvements = before - ragResult.improvements.length;
  }

  if (Array.isArray(ragResult.code_issues)) {
    const before = ragResult.code_issues.length;
    ragResult.code_issues = ragResult.code_issues.filter((ci) => {
      if (!hasFileRef(ci))        return false; // no file
      if (!hasProof(ci))          return false; // no behavior or proof
      if (hasForbiddenPhrase(ci)) return false; // vague/generic
      return true;
    });
    removed_issues = before - ragResult.code_issues.length;
  }

  const totalRemoved  = removed_risks + removed_improvements + removed_issues;
  const issuesWithProof = (ragResult.code_issues || [])
    .filter((ci) => (ci.proof || "").trim().length >= 10).length;

  // Inject validations block into result (overrides LLM-supplied one if present)
  ragResult.validations = {
    issues_with_proof:              issuesWithProof,
    rejected_due_to_no_evidence:    totalRemoved,
  };

  if (totalRemoved > 0) {
    console.log(`[RAG:PostFilter] Removed ${totalRemoved} insights (risks:${removed_risks} improvements:${removed_improvements} issues:${removed_issues}) — no proof or forbidden phrases`);
  } else {
    console.log(`[RAG:PostFilter] All insights passed. issues_with_proof=${issuesWithProof}`);
  }
  console.log(`[RAG:PostFilter] validations = ${JSON.stringify(ragResult.validations)}`);

  return ragResult;
}

// ─── Core Report Generator ────────────────────────────────────────────────────

/**
 * generateRAGReport — the single entry point for code intelligence analysis.
 *
 * ALWAYS runs in "code_analysis" mode.
 * NEVER includes GitHub issues, commits, or metrics.
 *
 * @param {string} projectId
 * @param {string} projectName
 * @returns {object} Full structured report with file-backed code insights
 */
async function generateRAGReport(projectId, projectName) {
  const startTime = Date.now();
  const queriesExecuted = ANALYSIS_QUERIES.length; // must always be 4

  console.log(`\n[RAG] ════════════════════════════════════════════════════════`);
  console.log(`[RAG] Code Intelligence Engine — ${MODE.toUpperCase()}`);
  console.log(`[RAG] Project: "${projectName}"`);
  console.log(`[RAG] Queries: ${queriesExecuted} | topK: ${TOP_K_PER_QUERY} per query`);
  console.log(`[RAG] Diversity: max ${MAX_CHUNKS_PER_FILE_PER_QUERY}/file per query, ${MAX_CHUNKS_PER_FILE_GLOBAL}/file global`);
  console.log(`[RAG] Min unique files required: ${MIN_UNIQUE_FILES_REQUIRED}`);

  if (queriesExecuted !== 4) {
    // Fail-safe: should never happen
    throw new Error(`[RAG] FATAL: queries_executed=${queriesExecuted}, expected 4`);
  }

  await initCollection(COLLECTION_NAME);

  // ── Step 1: Run 4 queries sequentially ───────────────────────────────────
  const queryResults = [];
  for (const q of ANALYSIS_QUERIES) {
    console.log(`\n[RAG] Running query [${q.id}]...`);
    const results = await retrieveForQuery(projectId, q.text, q.id, TOP_K_PER_QUERY);
    queryResults.push(results);
  }

  // Validate all 4 queries executed
  if (queryResults.length !== 4) {
    throw new Error(`[RAG] FATAL: only ${queryResults.length} queries completed`);
  }

  // ── Step 2: Merge + dedup ──────────────────────────────────────────────────
  let { chunks: mergedChunks, stats } = mergeAndDeduplicate(queryResults);

  // ── Step 3: Minimum-files fail-safe: retry with 2× topK ───────────────────
  const uniqueFilesAfterMerge = [...new Set(mergedChunks.map((c) => c.filePath))].length;
  if (uniqueFilesAfterMerge < MIN_UNIQUE_FILES_REQUIRED) {
    const higherTopK = TOP_K_PER_QUERY * 2;
    console.warn(`[RAG] ⚠️  Only ${uniqueFilesAfterMerge} unique files — re-running with topK=${higherTopK}`);

    const retryResults = [];
    for (const q of ANALYSIS_QUERIES) {
      const results = await retrieveForQuery(projectId, q.text, q.id, higherTopK);
      retryResults.push(results);
    }
    const retry = mergeAndDeduplicate(retryResults);
    if (retry.chunks.length > 0) {
      mergedChunks = retry.chunks;
      stats = retry.stats;
      console.log(`[RAG] Retry produced ${mergedChunks.length} chunks from ${[...new Set(mergedChunks.map(c => c.filePath))].length} files`);
    }
  }

  if (mergedChunks.length === 0) {
    console.warn("[RAG] ⚠️  No code chunks retrieved. Repository not indexed or no code files.");
    return {
      overview: "Unable to analyze — no source code indexed. Please trigger a re-index of the repository.",
      architecture: "N/A", modules: [], risks: [], improvements: [], code_issues: [],
      tech_stack: [], code_quality_score: 0,
      analysis_method: "multi_query_rag",
      _log: { mode: MODE, queries_executed: 0, topK: TOP_K_PER_QUERY, retrieved_chunks: 0, unique_files: 0, filtered_out_files: 0, final_prompt_tokens: 0 },
    };
  }

  // ── Step 4: Format context blocks ─────────────────────────────────────────
  const { contextBlock, filesContributing, totalTokens } = formatContextBlocks(mergedChunks);
  const uniqueFiles    = filesContributing.length;
  const filteredOutRaw = stats.totalRaw - mergedChunks.length;

  // ── Step 5: Pre-LLM validation ────────────────────────────────────────────
  const { valid, reason } = validateContext(contextBlock, uniqueFiles);
  if (!valid) {
    console.error(`[RAG] ❌ Context validation FAILED: ${reason}`);
    console.error(`[RAG] ABORTING LLM call — context rebuild required`);
    return {
      overview: `Analysis aborted — invalid context: ${reason}`,
      architecture: "N/A", modules: [], risks: [], improvements: [], code_issues: [],
      tech_stack: [], code_quality_score: 0,
      analysis_method: "multi_query_rag",
      _log: { mode: MODE, queries_executed: queriesExecuted, topK: TOP_K_PER_QUERY, retrieved_chunks: mergedChunks.length, unique_files: uniqueFiles, filtered_out_files: filteredOutRaw, final_prompt_tokens: totalTokens },
    };
  }

  // ── Structured log (mandatory) ────────────────────────────────────────────
  const structuredLog = {
    mode:              MODE,
    queries_executed:  queriesExecuted,
    topK:              TOP_K_PER_QUERY,
    retrieved_chunks:  mergedChunks.length,
    unique_files:      uniqueFiles,
    filtered_out_files: filteredOutRaw,
    final_prompt_tokens: totalTokens,
  };
  console.log(`\n[RAG] ── Retrieval Summary ──────────────────────────────────────`);
  console.log(`[RAG] ${JSON.stringify(structuredLog)}`);
  console.log(`[RAG] Contributing files: ${filesContributing.join(", ")}`);
  console.log(`[RAG] Query contributions: ${stats.queryContributions.map(q => `${q.queryId}=${q.count}`).join(", ")}`);
  console.log(`[RAG] ────────────────────────────────────────────────────────────`);

  // ── Step 6: LLM call with token guard ────────────────────────────────────
  const prompt         = buildStrictPrompt(contextBlock, projectName, filesContributing);
  const promptTokenEst = Math.ceil(prompt.length / 4);
  console.log(`[RAG] Estimated total prompt tokens: ~${promptTokenEst}`);

  // Progressive trimming if over budget: drop lowest-score chunks until under limit
  let finalChunks = mergedChunks;
  if (promptTokenEst > PROMPT_TOKEN_HARD_LIMIT) {
    console.warn(`[RAG] Prompt over token limit — trimming chunks. Before: ${finalChunks.length}`);
    // Sort ascending score so we drop weakest first
    const sorted = [...finalChunks].sort((a, b) => a.score - b.score);
    let rebuiltPrompt = prompt;
    while (sorted.length > 2 && Math.ceil(rebuiltPrompt.length / 4) > PROMPT_TOKEN_HARD_LIMIT) {
      sorted.shift(); // remove lowest-score chunk
      const { contextBlock: rb, filesContributing: rf } = formatContextBlocks(sorted);
      rebuiltPrompt = buildStrictPrompt(rb, projectName, rf);
    }
    finalChunks = sorted;
    console.log(`[RAG] Chunks removed for token budget. After: ${finalChunks.length}`);
  }

  const { contextBlock: finalContext, filesContributing: finalFiles } = formatContextBlocks(finalChunks);
  const finalPrompt     = buildStrictPrompt(finalContext, projectName, finalFiles);
  const finalTokenEst   = Math.ceil(finalPrompt.length / 4);
  console.log(`[RAG] Final chunk count: ${finalChunks.length} | Final prompt tokens: ~${finalTokenEst}`);
  console.log(`\n[RAG] Sending to LLM...`);
  const rawResult = await callLLM(finalPrompt, 700, true);

  // ── Step 7: Post-filter ───────────────────────────────────────────────────
  const filtered = postFilterInsights(rawResult);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[RAG] ✅ Complete in ${elapsed}s — risks:${filtered?.risks?.length || 0} improvements:${filtered?.improvements?.length || 0} issues:${filtered?.code_issues?.length || 0}`);
  console.log(`[RAG] ════════════════════════════════════════════════════════\n`);

  return {
    overview:           filtered?.overview      || "Analysis complete.",
    architecture:       filtered?.architecture  || "N/A",
    modules:            (filtered?.modules      || []).slice(0, 8),
    risks:              (filtered?.risks        || []).slice(0, 6),
    improvements:       (filtered?.improvements || []).slice(0, 6),
    code_issues:        (filtered?.code_issues  || []).slice(0, 10),
    tech_stack:         filtered?.tech_stack    || [],
    code_quality_score: typeof filtered?.code_quality_score === "number"
      ? Math.min(100, Math.max(0, filtered.code_quality_score))
      : 50,
    analysis_method:    "multi_query_rag",
    analysis_stats:     { ...structuredLog, elapsed_seconds: parseFloat(elapsed) },
    _log:               structuredLog,
  };
}

// ─── Single-query Copilot Q&A ────────────────────────────────────────────────

/**
 * queryWithRAG — copilot Q&A mode.
 * Uses the same 2-stage filter. Never sends GitHub data.
 */
async function retrieveRelevantChunks(projectId, queryText, topK = SINGLE_QUERY_TOP_K) {
  await initCollection(COLLECTION_NAME);

  const queryVector = await generateEmbedding(queryText);
  if (!queryVector || !Array.isArray(queryVector)) {
    console.warn("[RAG:CopilotQ] Failed to embed query");
    return [];
  }

  let results = await searchSimilarChunks(COLLECTION_NAME, queryVector, topK, buildCodeFilter(projectId));
  if (!results || results.length === 0) {
    console.warn("[RAG:CopilotQ] Code filter returned 0 — falling back to project-only");
    results = await searchSimilarChunks(COLLECTION_NAME, queryVector, topK, buildProjectFilter(projectId));
  }
  if (!results || results.length === 0) return [];

  const filtered = rejectNonCodeResults(results);
  if (filtered.length < results.length) {
    console.log(`[RAG:CopilotQ] Removed ${results.length - filtered.length} non-code results`);
  }

  return filtered.map((r) => ({
    filePath: r.payload?.file_path || "unknown",
    content:  (r.payload?.content || "").slice(0, MAX_CHUNK_CHARS),
    score:    r.score || 0,
  }));
}

async function queryWithRAG(projectId, question, projectName = "this project", topK = SINGLE_QUERY_TOP_K) {
  console.log(`\n[RAG:Copilot] Query: "${question.slice(0, 100)}"`);
  const chunks = await retrieveRelevantChunks(projectId, question, topK);
  console.log(`[RAG:Copilot] ${chunks.length} code chunks retrieved`);

  let contextBlock = chunks.length > 0
    ? chunks.map((c, i) => `[${i + 1}] File: ${c.filePath}\n${c.content}`).join("\n\n---\n\n")
    : "No relevant code context found. The repository may not be indexed yet.";

  if (contextBlock.length > 18000) contextBlock = contextBlock.substring(0, 18000) + "\n...[TRUNCATED]";

  const prompt = `You are an expert code assistant for the "${projectName}" codebase.

User Question:
${question}

Relevant Code Context (${chunks.length} chunks):
${contextBlock}

Rules:
- Answer based ONLY on the provided code
- Cite specific file names when relevant
- If context is insufficient, say so — do NOT hallucinate

Answer:`;

  const answer = await callLLM(prompt, 800, false);
  return {
    answer:     typeof answer === "string" ? answer.trim() : "Unable to generate answer.",
    sources:    chunks.map((c) => ({ file: c.filePath, score: Math.round(c.score * 100) / 100 })),
    chunksUsed: chunks.length,
    question,
  };
}

module.exports = {
  generateRAGReport,
  queryWithRAG,
  retrieveRelevantChunks,
};
