/**
 * Truncate a string to a given max length, keeping it within token bounds for Gemini.
 */
function truncate(str, maxLength = 500) {
  if (!str) return "";
  const s = String(str);
  if (s.length <= maxLength) return s;
  return s.substring(0, maxLength) + "...[TRUNCATED]";
}

/**
 * Assembles all repo tracking data into a clean text context string format.
 * Truncates specific fields to avoid hitting token limits.
 */
function buildRepoContext(project, latestSnapshot, allSnapshots = [], recentIssues = [], recentCommits = []) {
  if (!project) return "=== REPO CONTEXT ===\nNo project data provided.";

  const pName = truncate(project.name, 100);
  const pUrl = project.github_url || "N/A";
  const pDesc = truncate(project.description || "Not provided", 500);

  let context = `=== REPO CONTEXT ===\nProject: ${pName}\nGitHub: ${pUrl}\nDescription: ${pDesc}\n\n`;

  if (latestSnapshot) {
    const hs = latestSnapshot.health_score?.overall || 0;
    const label = latestSnapshot.health_score?.label || "Unknown";
    context += `=== CURRENT METRICS (latest snapshot) ===
- Health score: ${hs}/100 (${label})
- Commits (last 30 days): ${latestSnapshot.metrics?.commit_count || 0}
- Open issues: ${latestSnapshot.metrics?.open_issues || 0}
- Closed issues: ${latestSnapshot.metrics?.closed_issues || 0}
- Stale issues (>30 days old): ${latestSnapshot.metrics?.stale_issues || 0}
- Open PRs: ${latestSnapshot.metrics?.open_prs || 0}
- Merged PRs: ${latestSnapshot.metrics?.merged_prs || 0}
- Contributors: ${latestSnapshot.metrics?.contributors || 0}
- Snapshot date: ${latestSnapshot.snapshot_date ? new Date(latestSnapshot.snapshot_date).toISOString() : "Unknown"}\n\n`;
  } else {
    context += `=== CURRENT METRICS ===\nNo snapshot data available.\n\n`;
  }

  if (allSnapshots && allSnapshots.length > 0) {
    // Determine sort behavior and isolate the last 5 chronologically prior to generating the text
    const sorted = [...allSnapshots].sort((a, b) => new Date(b.snapshot_date) - new Date(a.snapshot_date));
    const recent5 = sorted.slice(0, 5).reverse();
    context += `=== TREND (last ${allSnapshots.length} snapshots) ===\n`;
    recent5.forEach(s => {
      const date = s.snapshot_date ? new Date(s.snapshot_date).toISOString().split('T')[0] : "Unknown";
      const score = s.health_score?.overall || 0;
      const commits = s.metrics?.commit_count || 0;
      const issues = s.metrics?.open_issues || 0;
      context += `[${date}]: score ${score} | commits ${commits} | open_issues ${issues}\n`;
    });
    context += "\n";
  }

  if (recentIssues && recentIssues.length > 0) {
    context += `=== RECENT ISSUES (up to 10) ===\n`;
    const issues = recentIssues.slice(0, 10);
    issues.forEach(i => {
      const title = truncate(i.title, 200);
      const stale = i.is_stale ? "yes" : "no";
      const date = i.created_at ? new Date(i.created_at).toISOString().split('T')[0] : "Unknown";
      context += `[#${i.number || '?'}] ${title} | ${i.state || 'open'} | ${date} | (stale: ${stale})\n`;
    });
    context += "\n";
  }

  if (recentCommits && recentCommits.length > 0) {
    context += `=== RECENT COMMITS (up to 10) ===\n`;
    const commits = recentCommits.slice(0, 10);
    commits.forEach(c => {
      const sha = c.sha ? c.sha.substring(0, 7) : "???????";
      const msg = truncate(c.message, 150).replace(/\n/g, " ");
      const author = truncate(c.author, 50);
      const date = c.date ? new Date(c.date).toISOString().split('T')[0] : "Unknown";
      context += `[${sha}] ${msg} | ${author} | ${date}\n`;
    });
    context += "\n";
  }

  return context.trim();
}

/**
 * Minify code chunk to save LLM tokens by removing comments, blank lines, logs,
 * and maintaining essential structure (imports, definitions).
 */
function minifyCodeChunk(code) {
  if (!code || typeof code !== "string") return "";
  
  // 1. Remove single-line comments (// ...) and multi-line comments (/* ... */) and bash-style (# ...)
  let minified = code
    .replace(/\/\*[\s\S]*?\*\//g, "") // Multi-line
    .replace(/\/\/.*/g, "")           // Single-line (C/JS/Java)
    .replace(/(?<!['"])\s*#.*/g, ""); // Bash/Python comments (rudimentary)

  // 2. Remove typical debug/log statements
  minified = minified
    .replace(/console\.(log|debug|info|warn|error|trace)\s*\([\s\S]*?\);?/g, "")
    .replace(/System\.out\.print(ln)?\s*\([\s\S]*?\);?/g, "");

  // 3. Strip empty lines & excessive whitespace
  minified = minified
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join("\n");

  return minified;
}

module.exports = { buildRepoContext, minifyCodeChunk, truncate };
