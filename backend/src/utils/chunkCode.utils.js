/**
 * chunkCode.utils.js
 *
 * Shared token-aware, structure-aware code chunking utilities.
 *
 * Design principles:
 *  - Never mix multiple files in one chunk (enforced in indexRepositoryContext)
 *  - Split at logical boundaries (function / class / export declarations)
 *  - Target ~450 tokens (≈1800 chars) per chunk, 60-token (≈240 char) overlap
 *  - Embedding config is versioned → any change auto-invalidates stale Qdrant indexes
 */

const crypto = require("crypto");

// ─── Token Estimation ─────────────────────────────────────────────────────────

/** Rough 4-chars-per-token estimate, consistent with OpenAI/MiniLM tokenizers. */
const CHARS_PER_TOKEN = 4;

/**
 * Estimate token count of a string.
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// ─── Embedding Version ────────────────────────────────────────────────────────

/**
 * Chunking configuration.
 * ⚠️  Bump `version` whenever strategy, token targets, or model changes.
 * This drives automatic Qdrant re-indexing on upgrade.
 */
const CHUNKING_CONFIG = {
  version:       "2.0.0",          // bump to force re-embed on next run
  strategy:      "logical_boundary_v1",
  targetTokens:  450,              // ~1800 chars
  overlapTokens: 60,               // ~240 chars
  model:         "Xenova/all-MiniLM-L6-v2",
};

/**
 * Compute a deterministic 12-char hex hash from the current chunking config.
 * Stored in MongoDB `projects.embedding_version` — mismatch triggers re-indexing.
 */
function computeEmbeddingVersion() {
  return crypto
    .createHash("md5")
    .update(JSON.stringify(CHUNKING_CONFIG))
    .digest("hex")
    .slice(0, 12);
}

const CURRENT_EMBEDDING_VERSION = computeEmbeddingVersion();

// ─── Logical Boundary Detection ───────────────────────────────────────────────

/**
 * Patterns that mark the START of a logical code block.
 * Only fires on root-level indentation to avoid false positives from
 * nested helpers / inner classes.
 */
const ROOT_BOUNDARY_PATTERNS = [
  // JavaScript / TypeScript — functions and arrow functions
  /^(export\s+)?(async\s+)?function[\s*]\w+/,
  /^(export\s+)?(default\s+)?(abstract\s+)?class\s+\w+/,
  /^(export\s+)(const|let|var)\s+\w+\s*=/,
  /^(export\s+default\s*)(function|class|\w)/,
  /^const\s+\w+\s*=\s*(async\s+)?\(/,          // const fn = async (
  /^const\s+\w+\s*=\s*\{/,                     // const config = {
  /^module\.exports\s*=/,
  /^router\.(get|post|put|delete|patch|use|all)\s*\(/,
  /^app\.(get|post|put|delete|patch|use|all)\s*\(/,
  // Section dividers (common in large JS/TS files)
  /^\/\/\s*─{3,}/,
  /^\/\/\s*={3,}/,
  /^\/\/\s*-{3,}/,
  /^\/\*\*/,                                    // JSDoc block start
];

/** Patterns that mark class-member boundaries (allowed at indent ≤ 2) */
const CLASS_MEMBER_PATTERNS = [
  /^(public|private|protected|static|abstract|override|readonly)\s+/,
  /^(async\s+)?\w+\s*\([^)]*\)\s*\{/,          // method(args) {
];

/** Python / Ruby / Go / Rust root-level boundaries */
const OTHER_LANG_PATTERNS = [
  /^(async\s+)?def\s+\w+/,                     // Python
  /^class\s+\w+/,                              // Python, Ruby
  /^@\w+/,                                     // Python / TS decorator
  /^func\s+\w+/,                               // Go
  /^type\s+\w+\s+(struct|interface)/,          // Go
  /^(pub\s+)?(async\s+)?fn\s+\w+/,            // Rust
  /^(pub\s+)?(struct|enum|impl|trait)\s+/,    // Rust
  /^def\s+\w+/,                               // Ruby
];

/**
 * Returns true when `line` represents a logical code boundary worth splitting at.
 * @param {string} line  - A single line from the file.
 * @returns {boolean}
 */
function isBoundaryLine(line) {
  const trimmed = line.trimStart();
  if (!trimmed) return false;
  const indent = line.length - trimmed.length;

  // Root-level (indent=0): any root boundary pattern
  if (indent === 0) {
    return (
      ROOT_BOUNDARY_PATTERNS.some((p) => p.test(trimmed)) ||
      OTHER_LANG_PATTERNS.some((p) => p.test(trimmed))
    );
  }

  // Shallow indent (≤ 2): allow class-member–style patterns
  if (indent <= 2) {
    return CLASS_MEMBER_PATTERNS.some((p) => p.test(trimmed));
  }

  return false;
}

// ─── Core Chunker ─────────────────────────────────────────────────────────────

/**
 * Split a SINGLE file's content into token-aware chunks at logical boundaries.
 *
 * Algorithm:
 *   1. Walk lines, record "boundary" line indices.
 *   2. Accumulate segments between boundaries until we exceed `targetChars`.
 *   3. On flush, prepend the last `overlapChars` of the previous chunk
 *      to the NEW chunk's embedding text (stored separately from payload text).
 *   4. Oversized single segments fall back to line-by-line splitting.
 *
 * @param {string} filePath  - Used only for logging.
 * @param {string} content   - Raw file content (NOT pre-minified).
 * @param {object} [options] - Override targetTokens / overlapTokens.
 * @returns {Array<{ text: string, embeddingPrefix: string, tokens: number, chunkIndex: number }>}
 *          `text`            → clean chunk content (stored in Qdrant payload).
 *          `embeddingPrefix` → overlap text from previous chunk (prepended before embedding only).
 */
function chunkFileAtBoundaries(filePath, content, options = {}) {
  const targetTokens  = options.targetTokens  ?? CHUNKING_CONFIG.targetTokens;
  const overlapTokens = options.overlapTokens ?? CHUNKING_CONFIG.overlapTokens;
  const targetChars   = targetTokens  * CHARS_PER_TOKEN;   // ≈ 1800
  const overlapChars  = overlapTokens * CHARS_PER_TOKEN;   // ≈ 240

  if (!content || content.trim().length === 0) return [];

  const lines = content.split("\n");
  const chunks = [];

  // ── Collect boundary indices ───────────────────────────────────────────────
  const boundaries = [0]; // always start at line 0
  for (let i = 1; i < lines.length; i++) {
    if (isBoundaryLine(lines[i])) boundaries.push(i);
  }
  boundaries.push(lines.length); // sentinel for final segment

  // ── Accumulate segments into chunks ───────────────────────────────────────
  let currentLines  = [];
  let currentChars  = 0;
  let chunkIndex    = 0;
  let lastChunkText = ""; // tail of previous chunk → used for overlap prefix

  const flushChunk = () => {
    if (currentLines.length === 0) return;
    const text = currentLines.join("\n").trim();
    if (text.length === 0) return;

    // Overlap prefix: last `overlapChars` of the PREVIOUS chunk's text.
    // NOT stored in `text` (payload stays clean); used only for embedding.
    const embeddingPrefix =
      lastChunkText.length > overlapChars
        ? lastChunkText.slice(-overlapChars)
        : lastChunkText;

    chunks.push({
      text,
      embeddingPrefix,
      tokens: estimateTokens(text),
      chunkIndex: chunkIndex++,
    });

    lastChunkText = text;
    currentLines  = [];
    currentChars  = 0;
  };

  for (let bi = 0; bi < boundaries.length - 1; bi++) {
    const segLines = lines.slice(boundaries[bi], boundaries[bi + 1]);
    const segChars = segLines.reduce((s, l) => s + l.length + 1, 0);

    // If adding this segment would overflow AND we already have content → flush
    if (currentChars + segChars > targetChars && currentLines.length > 0) {
      flushChunk();
    }

    if (segChars > targetChars) {
      // Oversized segment: fall back to line-by-line splitting
      for (const line of segLines) {
        const lineLen = line.length + 1;
        if (currentChars + lineLen > targetChars && currentLines.length > 0) {
          flushChunk();
        }
        currentLines.push(line);
        currentChars += lineLen;
      }
    } else {
      for (const line of segLines) {
        currentLines.push(line);
        currentChars += line.length + 1;
      }
    }
  }
  flushChunk(); // flush remainder

  // Edge case: entire file fits in one chunk (short file)
  if (chunks.length === 0 && content.trim().length > 0) {
    chunks.push({
      text:            content.trim(),
      embeddingPrefix: "",
      tokens:          estimateTokens(content),
      chunkIndex:      0,
    });
  }

  return chunks;
}

// ─── File Priority Scoring ────────────────────────────────────────────────────

/** Directories / path patterns → HIGH priority (core business + infrastructure) */
const HIGH_PRIORITY_PATTERNS = [
  /\/(src|core|engine|systems|store)\//i,
  /\/(api|controllers?|services?|routes?)\//i,
  /\/(middleware|models?|jobs?|lib)\//i,
  // Root-level entry points
  /^src\//i, /^core\//i, /^api\//i, /^lib\//i, /^app\//i,
  /^controllers?\//i, /^services?\//i, /^routes?\//i,
  /^middleware\//i,   /^models?\//i,   /^jobs?\//i,
  /^store\//i,        /^systems?\//i,  /^engine\//i,
];

/** MEDIUM priority: utilities, hooks, shared code */
const MEDIUM_PRIORITY_PATTERNS = [
  /\/(utils?|helpers?|hooks?|shared|common)\//i,
  /\/(config|constants?|types?|interfaces?)\//i,
  /^utils?\//i, /^helpers?\//i, /^hooks?\//i,
  /^config\//i, /^shared\//i,   /^common\//i,
  /^constants?\//i,
];

/**
 * Score a file's indexing priority based on its path.
 * @param {string} filePath
 * @returns {{ priority: 'high'|'medium'|'low', score: 0|1|2 }}
 */
function scoreFilePriority(filePath) {
  const norm = filePath.replace(/\\/g, "/");

  // LOW: noise / config / generated — checked first to fast-exit low-value files
  if (isNoiseFile(filePath))                                         return { priority: "low",    score: 2 };
  if (/\.(md|css|scss|less|env|lock|log)$/i.test(norm))             return { priority: "low",    score: 2 };
  if (/^(docs?|public|static|assets?)\//i.test(norm))               return { priority: "low",    score: 2 };
  if (/\/(docs?|public|static|assets?)\//i.test(norm))              return { priority: "low",    score: 2 };

  // HIGH
  if (HIGH_PRIORITY_PATTERNS.some((p) => p.test(norm)))             return { priority: "high",   score: 0 };

  // MEDIUM
  if (MEDIUM_PRIORITY_PATTERNS.some((p) => p.test(norm)))           return { priority: "medium", score: 1 };

  return { priority: "medium", score: 1 }; // default: treat as medium
}

// ─── Language Detection ───────────────────────────────────────────────────────

const LANGUAGE_MAP = {
  ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
  ".ts": "typescript", ".tsx": "typescript",
  ".py": "python",
  ".java": "java",
  ".go": "go",
  ".rs": "rust",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".c": "c",  ".h": "c",
  ".cpp": "cpp", ".hpp": "cpp", ".cc": "cpp",
  ".cs": "csharp",
  ".scala": "scala",
  ".sh": "shell", ".bash": "shell", ".zsh": "shell",
  ".sql": "sql",
  ".yaml": "yaml", ".yml": "yaml",
  ".json": "json",
  ".html": "html", ".htm": "html",
  ".css": "css", ".scss": "css", ".less": "css",
  ".vue": "vue",
  ".svelte": "svelte",
};

/**
 * Detect programming language from file extension.
 * @param {string} filePath
 * @returns {string}
 */
function getLanguageFromPath(filePath) {
  const dot = filePath.lastIndexOf(".");
  if (dot === -1) return "unknown";
  const ext = filePath.slice(dot).toLowerCase();
  return LANGUAGE_MAP[ext] || "unknown";
}

// ─── Noise File Detection ─────────────────────────────────────────────────────

/**
 * Files that should be completely excluded from embedding.
 * Stricter than "low priority" — these have zero signal value.
 */
const NOISE_PATTERNS = [
  // Binary / media assets
  /\.(png|jpe?g|gif|svg|ico|webp|bmp|tiff?|avif)$/i,
  /\.(woff2?|ttf|eot|otf)$/i,
  /\.(pdf|zip|tar|gz|7z|rar|iso|dmg|exe|dll|so|dylib)$/i,
  /\.(mp[34]|wav|ogg|avi|mov|webm|flac)$/i,

  // Generated / compiled
  /\.min\.(js|css)$/i,
  /\.bundle\.js$/i,
  /\.d\.ts$/,
  /\.map$/,

  // Test artifacts
  /\.(test|spec)\.(js|ts|jsx|tsx|mjs|cjs)$/i,
  /__tests__\//i,
  /\/__snapshots__\//i,
  /\/fixtures\//i,
  /\/e2e\//i,

  // Lock / changelog / license (pure metadata)
  /package-lock\.json$/i,
  /yarn\.lock$/i,
  /pnpm-lock\.yaml$/i,
  /Gemfile\.lock$/i,
  /composer\.lock$/i,
  /^(README|CHANGELOG|LICENSE|CONTRIBUTING|SECURITY|AUTHORS?|CODEOWNERS?)(\.\w+)?$/i,

  // Build output
  /^(dist|build|out|\.next|\.nuxt|\.vite|\.svelte-kit|coverage|\.nyc_output|__pycache__)\//i,

  // Secrets / environment
  /^\.env(\.\w+)?$/i,

  // Documentation directories
  /^(docs?|documentation|wiki)\//i,
  /\/(docs?|documentation|wiki)\//i,

  // IDE / editor config
  /^(\.vscode|\.idea|\.eclipse)\//i,

  // Dependencies
  /^(node_modules|vendor|bower_components)\//i,

  // Misc generated
  /^repomix-output\./i,
];

/**
 * Returns true when a file should be completely excluded from indexing.
 * @param {string} filePath
 * @returns {boolean}
 */
function isNoiseFile(filePath) {
  const norm = filePath.replace(/\\/g, "/");
  return NOISE_PATTERNS.some((p) => p.test(norm));
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  estimateTokens,
  chunkFileAtBoundaries,
  isBoundaryLine,
  scoreFilePriority,
  getLanguageFromPath,
  isNoiseFile,
  computeEmbeddingVersion,
  CURRENT_EMBEDDING_VERSION,
  CHUNKING_CONFIG,
  CHARS_PER_TOKEN,
};
