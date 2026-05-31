const axios = require("axios");

// Files/folders to skip entirely
const SKIP_PATHS = [
  "node_modules", "vendor", ".git", "dist", "build", ".next",
  "__pycache__", ".cache", "coverage", ".nyc_output", "public", "assets"
];

// Strictly ONLY allow known code source extensions
const ALLOWED_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".go", ".rb", ".php", 
  ".cs", ".c", ".cpp", ".h", ".html", ".css", ".scss", ".json", ".md", 
  ".yml", ".yaml", ".sh", ".sql", ".rs", ".swift", ".kt"
]);

// Max file size to analyze (100 KB) prevents bloated bundles from passing
const MAX_FILE_BYTES = 100 * 1024;

const getAuthHeaders = (token) => {
  const finalToken = token || process.env.GITHUB_TOKEN;
  if (!finalToken) return { Accept: "application/vnd.github+json" };
  return {
    Authorization: token ? `Bearer ${token}` : `token ${finalToken}`,
    Accept: "application/vnd.github+json"
  };
};

/**
 * Returns whether a path should be skipped.
 */
function shouldSkipPath(filePath) {
  const parts = filePath.split("/");
  if (parts.some(p => SKIP_PATHS.includes(p))) return true;

  // Check strict allowlist extension
  const lower = filePath.toLowerCase();
  
  // Exclude explicit locks and configs that might slip by
  if (lower.endsWith("package-lock.json") || lower.endsWith("yarn.lock") || lower.endsWith(".min.js")) return true;

  for (const ext of ALLOWED_EXTENSIONS) {
    if (lower.endsWith(ext)) return false; // Allowed!
  }
  
  return true; // Not in allowlist, discard
}

/**
 * List all analyzable files in a repo using the git tree API.
 * Returns array of { path, size } objects.
 */
async function listRepoFiles(owner, repo, token) {
  try {
    // First get default branch
    const repoRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: getAuthHeaders(token)
    });
    const branch = repoRes.data.default_branch || "main";

    // Fetch recursive file tree
    const treeRes = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      { headers: getAuthHeaders(token) }
    );

    const files = (treeRes.data.tree || [])
      .filter(item => item.type === "blob")
      .filter(item => !shouldSkipPath(item.path))
      .filter(item => (item.size || 0) <= MAX_FILE_BYTES && (item.size || 0) > 0)
      .map(item => ({ path: item.path, size: item.size || 0 }));

    return files;
  } catch (error) {
    console.error("[GitHubFiles] listRepoFiles error:", error.message);
    return [];
  }
}

/**
 * Fetch decoded content of a single file.
 * Returns the file content as a string, or null on failure.
 */
async function getFileContent(owner, repo, filePath, token) {
  try {
    const res = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`,
      { headers: getAuthHeaders(token) }
    );

    if (res.data.encoding === "base64" && res.data.content) {
      return Buffer.from(res.data.content, "base64").toString("utf-8");
    }
    return null;
  } catch (error) {
    // File may have moved or be inaccessible — not a hard error
    return null;
  }
}

/**
 * Group file paths by their top-level folder (module).
 * e.g. "src/utils/helpers.js" → module "src/utils"
 *      "README.md"           → module "root"
 */
function groupFilesByModule(files) {
  const modules = {};
  for (const file of files) {
    const parts = file.path.split("/");
    const moduleName = parts.length > 1 ? parts.slice(0, -1).join("/") : "root";
    if (!modules[moduleName]) modules[moduleName] = [];
    modules[moduleName].push(file);
  }
  return modules;
}

module.exports = { listRepoFiles, getFileContent, groupFilesByModule };
