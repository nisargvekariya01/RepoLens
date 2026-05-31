/**
 * repomix.service.js
 *
 * Wraps the Repomix CLI to pack a local repository into an XML context file,
 * then parses, filters, and returns per-file content for downstream embedding.
 *
 * v2 changes (RAG precision upgrade):
 *   - Per-file output (no multi-file chunk packing — that happens in aiAnalysis.service)
 *   - isNoiseFile() + scoreFilePriority() replace LOW_VALUE_PATTERNS
 *   - Cache format versioned (CACHE_VERSION) → auto-invalidation on strategy change
 *   - Only HIGH + MEDIUM priority files are returned (LOW excluded)
 *   - File content stored raw (not minified) so logical boundary chunking works downstream
 */

const { spawn }  = require("child_process");
const fs         = require("fs");
const path       = require("path");
const crypto     = require("crypto");
const { getDb }  = require("../config/db");
const {
  isNoiseFile,
  scoreFilePriority,
  getLanguageFromPath,
} = require("../utils/chunkCode.utils");

// ─── Config ───────────────────────────────────────────────────────────────────

const CACHE_TTL_HOURS = parseInt(process.env.REPOMIX_CACHE_TTL_HOURS || "24", 10);
const MAX_FILES_TO_CACHE = 300; // max files stored in MongoDB cache per project

/**
 * Cache format version. Bump this whenever the filtered/returned file
 * structure changes so old cache entries are automatically discarded.
 */
const CACHE_VERSION = "2.0";

// CLI-level exclusions passed to --ignore (prevents repomix from even scanning these)
const EXCLUDE_PATTERNS = [
  "node_modules",
  "dist",
  "build",
  ".next",
  ".nuxt",
  ".svelte-kit",
  "coverage",
  ".nyc_output",
  "vendor",
  "__pycache__",
  ".cache",
  "*.min.js",
  "*.min.css",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "*.lock",
  "repomix-output.xml",
];

// ─── Hash Utilities ───────────────────────────────────────────────────────────

/**
 * Compute a stable hash for a repo based on owner/name + latest commit SHA.
 * Falls back gracefully when no commit SHA is provided.
 */
function computeRepoHash(owner, repoName, latestCommitSha) {
  const input = `${owner}/${repoName}:${latestCommitSha || "unknown"}`;
  return crypto.createHash("sha256").update(input).digest("hex");
}

// ─── Cache Layer ──────────────────────────────────────────────────────────────

/**
 * Check MongoDB for a cached Repomix result.
 * Validates: TTL (expires_at), cache format version (cache_version).
 * Returns the cached document or null.
 */
async function getCachedResult(projectId, repoHash) {
  try {
    const db = getDb();
    const cached = await db.collection("repomix_cache").findOne({
      project_id:    projectId.toString(),
      repo_hash:     repoHash,
      cache_version: CACHE_VERSION,
      expires_at:    { $gt: new Date() },
    });

    if (cached) {
      console.log(`[Repomix] Cache HIT for project ${projectId} (hash: ${repoHash.slice(0, 12)}..., v${CACHE_VERSION})`);
      return cached;
    }

    console.log(`[Repomix] Cache MISS for project ${projectId} (no valid v${CACHE_VERSION} entry)`);
    return null;
  } catch (err) {
    console.warn("[Repomix] Cache lookup failed:", err.message);
    return null;
  }
}

/**
 * Store a Repomix result in MongoDB with a TTL-based expiry.
 * Stores `files` (sorted, filtered, raw content) instead of old chunked format.
 */
async function saveCachedResult(projectId, repoHash, summaryData) {
  try {
    const db = getDb();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + CACHE_TTL_HOURS);

    await db.collection("repomix_cache").updateOne(
      { project_id: projectId.toString(), repo_hash: repoHash },
      {
        $set: {
          project_id:    projectId.toString(),
          repo_hash:     repoHash,
          cache_version: CACHE_VERSION,
          ...summaryData,
          expires_at:  expiresAt,
          updated_at:  new Date(),
        },
      },
      { upsert: true }
    );
    console.log(`[Repomix] Cache saved for project ${projectId} (TTL: ${CACHE_TTL_HOURS}h, v${CACHE_VERSION})`);
  } catch (err) {
    console.warn("[Repomix] Cache save failed:", err.message);
  }
}

// ─── Repomix CLI Runner ───────────────────────────────────────────────────────

/**
 * Run `npx repomix@latest` inside the given local repo path.
 * Returns the path to the generated repomix-output.xml file.
 */
async function runRepomixCli(localRepoPath) {
  const outputFile = path.join(localRepoPath, "repomix-output.xml");

  if (fs.existsSync(outputFile)) {
    fs.unlinkSync(outputFile);
  }

  const ignoreArg = EXCLUDE_PATTERNS.join(",");
  const isWindows = process.platform === "win32";

  return new Promise((resolve, reject) => {
    console.log(`[Repomix] Generating XML snapshot in: ${localRepoPath}`);

    // On Windows, npx is a .cmd wrapper — must be invoked through cmd.exe.
    let child;
    if (isWindows) {
      child = spawn(
        "cmd",
        ["/c", "npx", "repomix@latest", "--output", "repomix-output.xml", "--ignore", ignoreArg, "--style", "xml"],
        { cwd: localRepoPath, shell: false, stdio: ["ignore", "pipe", "pipe"] }
      );
    } else {
      child = spawn(
        "npx",
        ["repomix@latest", "--output", "repomix-output.xml", "--ignore", ignoreArg, "--style", "xml"],
        { cwd: localRepoPath, shell: false, stdio: ["ignore", "pipe", "pipe"] }
      );
    }

    let stderr = "";
    child.stdout?.on("data", () => {}); // drain stdout
    child.stderr?.on("data", (data) => { stderr += data.toString(); });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("[Repomix] CLI timed out after 5 minutes"));
    }, 5 * 60 * 1000);

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0 && fs.existsSync(outputFile)) {
        console.log(`[Repomix] XML generated successfully → ${outputFile}`);
        resolve(outputFile);
      } else {
        console.error(`[Repomix] CLI exited with code ${code}. stderr: ${stderr.slice(0, 500)}`);
        reject(new Error(`Repomix CLI failed (code ${code}): ${stderr.slice(0, 300)}`));
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`[Repomix] Spawn error: ${err.message}`));
    });
  });
}

// ─── XML Parser ───────────────────────────────────────────────────────────────

/**
 * Parse the repomix-output.xml file.
 * Returns { projectTree, files: [{ path, content }], tokenCount }
 */
function parseRepomixXml(xmlContent) {
  const result = { projectTree: "", files: [], tokenCount: 0 };

  const structureMatch = xmlContent.match(/<repository_structure>([\s\S]*?)<\/repository_structure>/i);
  if (structureMatch) result.projectTree = structureMatch[1].trim();

  const tokenMatch = xmlContent.match(/<total_tokens>(\d+)<\/total_tokens>/i);
  if (tokenMatch) result.tokenCount = parseInt(tokenMatch[1], 10);

  const fileRegex = /<file\s+path="([^"]+)">([\s\S]*?)<\/file>/gi;
  let match;
  while ((match = fileRegex.exec(xmlContent)) !== null) {
    const filePath    = match[1].trim();
    const fileContent = match[2].trim();
    if (filePath && fileContent) {
      result.files.push({ path: filePath, content: fileContent });
    }
  }

  console.log(`[Repomix] Parsed XML: ${result.files.length} files, ~${result.tokenCount} tokens`);
  return result;
}

// ─── File Prioritization ──────────────────────────────────────────────────────

/**
 * Filter and prioritize files for indexing.
 *
 * Rules:
 *   • Noise files (binaries, build outputs, secrets, docs) → always excluded
 *   • LOW priority files → excluded (not worth embedding)
 *   • HIGH priority → indexed first
 *   • MEDIUM priority → indexed after HIGH
 *   • Cap at MAX_FILES_TO_CACHE (prevent MongoDB document size overflow)
 *
 * Three-tier fallback to ensure we NEVER return an empty set:
 *   Tier 1 — Full filter (noise + low priority)
 *   Tier 2 — Noise only (relax priority if too few files)
 *   Tier 3 — No filter (safety net for minimal repos)
 */
function filterAndPrioritizeFiles(allFiles) {
  const before = allFiles.length;
  console.log(`[Repomix] Prioritizing ${before} total files...`);

  // ── Tier 1: Remove noise AND low-priority files ────────────────────────────
  let filtered = allFiles
    .map((f) => {
      const { priority, score } = scoreFilePriority(f.path);
      return { ...f, priority, priorityScore: score };
    })
    .filter((f) => !isNoiseFile(f.path) && f.priority !== "low");

  console.log(`[Repomix] After noise+priority filter: ${filtered.length} files`);

  // ── Tier 2: Only remove binaries/noise (relax priority filter) ─────────────
  if (filtered.length < 30 && before > 0) {
    console.warn(`[Repomix] Too few files after priority filter (${filtered.length}/${before}) — relaxing to noise-only`);
    filtered = allFiles
      .map((f) => {
        const { priority, score } = scoreFilePriority(f.path);
        return { ...f, priority, priorityScore: score };
      })
      .filter((f) => !isNoiseFile(f.path));
    console.log(`[Repomix] After relaxed filter: ${filtered.length} files`);
  }

  // ── Tier 3: Safety net ─────────────────────────────────────────────────────
  if (filtered.length === 0) {
    console.warn(`[Repomix] All files filtered — using all ${before} files as fallback`);
    filtered = allFiles.map((f) => {
      const { priority, score } = scoreFilePriority(f.path);
      return { ...f, priority, priorityScore: score };
    });
  }

  // ── Sort: HIGH first, then MEDIUM, then alphabetically within each tier ────
  filtered.sort((a, b) => {
    if (a.priorityScore !== b.priorityScore) return a.priorityScore - b.priorityScore;
    return a.path.localeCompare(b.path);
  });

  // ── Log priority breakdown ─────────────────────────────────────────────────
  const high   = filtered.filter((f) => f.priority === "high").length;
  const medium = filtered.filter((f) => f.priority === "medium").length;
  const low    = filtered.filter((f) => f.priority === "low").length;
  console.log(`[Repomix] Priority breakdown — HIGH: ${high}, MEDIUM: ${medium}, LOW: ${low}`);
  console.log(`[Repomix] Skipped (noise+low): ${before - filtered.length} files`);

  // ── Cap to prevent cache overflow ─────────────────────────────────────────
  if (filtered.length > MAX_FILES_TO_CACHE) {
    console.warn(`[Repomix] Capping files at ${MAX_FILES_TO_CACHE} (was ${filtered.length}). HIGH priority preserved.`);
    filtered = filtered.slice(0, MAX_FILES_TO_CACHE);
  }

  return filtered;
}

// ─── Main Pipeline Entry Point ────────────────────────────────────────────────

/**
 * Full Repomix pipeline for a single project.
 *
 * Returns { projectTree, files, tokenCount, fromCache, repoHash }
 *
 * `files` is an array of:
 *   { path: string, content: string, priority: 'high'|'medium'|'low', language: string }
 *
 * Downstream (aiAnalysis.service → indexRepositoryContext) performs:
 *   - Logical boundary chunking per file
 *   - MiniLM embedding of each sub-chunk
 *   - Upsert into Qdrant
 *
 * @param {Object} project           - MongoDB project document (must have local_path)
 * @param {string} latestCommitSha   - Optional latest commit SHA for cache keying
 * @param {Function} onProgress      - Optional async (pct, msg) progress callback
 */
async function runRepomixPipeline(project, latestCommitSha = null, onProgress = null) {
  const notify = async (pct, msg) => {
    if (onProgress) await onProgress(pct, msg).catch(() => {});
  };

  const projectId = project._id.toString();
  const repoHash  = computeRepoHash(project.repo_owner, project.repo_name, latestCommitSha);

  // ── 1. Cache check ────────────────────────────────────────────────────────
  const cached = await getCachedResult(projectId, repoHash);
  if (cached && Array.isArray(cached.files) && cached.files.length > 0) {
    return {
      projectTree: cached.projectTree || "",
      files:       cached.files,
      tokenCount:  cached.tokenCount || 0,
      fromCache:   true,
      repoHash,
    };
  }

  // ── 2. Validate local path ────────────────────────────────────────────────
  const localPath = project.local_path;
  if (!localPath || !fs.existsSync(localPath)) {
    throw new Error(
      `[Repomix] local_path not found: "${localPath}". Repomix mode requires a locally cloned repository.`
    );
  }

  // ── 3. Run Repomix CLI ────────────────────────────────────────────────────
  await notify(10, "Running Repomix...");
  const xmlOutputPath = await runRepomixCli(localPath);

  // ── 4. Parse XML ──────────────────────────────────────────────────────────
  await notify(20, "Parsing XML...");
  const xmlContent = fs.readFileSync(xmlOutputPath, "utf-8");
  const { projectTree, files: rawFiles, tokenCount } = parseRepomixXml(xmlContent);

  // Clean up CLI output
  try { fs.unlinkSync(xmlOutputPath); } catch (_) {}

  if (rawFiles.length === 0) {
    throw new Error("[Repomix] XML parsing produced 0 files. Check Repomix output format.");
  }

  // ── 5. Filter + prioritize ────────────────────────────────────────────────
  await notify(30, "Prioritizing files...");
  const filteredFiles = filterAndPrioritizeFiles(rawFiles);

  if (filteredFiles.length === 0) {
    throw new Error("[Repomix] All files filtered out. Review isNoiseFile / scoreFilePriority rules.");
  }

  // ── 6. Attach language metadata ───────────────────────────────────────────
  const enrichedFiles = filteredFiles.map((f) => ({
    path:     f.path,
    content:  f.content,
    priority: f.priority,
    language: getLanguageFromPath(f.path),
  }));

  console.log(`[Repomix] Final file set: ${enrichedFiles.length} files ready for embedding`);

  // ── 7. Save to cache (fire and forget) ────────────────────────────────────
  await notify(40, "Caching results...");
  saveCachedResult(projectId, repoHash, {
    projectTree,
    files:      enrichedFiles,
    tokenCount,
  }).catch((err) => console.warn("[Repomix] Background cache save failed:", err.message));

  return {
    projectTree,
    files:     enrichedFiles,
    tokenCount,
    fromCache: false,
    repoHash,
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  runRepomixPipeline,
  computeRepoHash,
  getCachedResult,
  saveCachedResult,
  parseRepomixXml,
  filterAndPrioritizeFiles,
};
