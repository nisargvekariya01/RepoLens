/**
 * Contributor Analytics Processor
 * Merges contributors[] and commits[] into enriched analytics with bus factor.
 */

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalize an author key from any commit shape.
 * Prefers login (unique across GitHub) → name → "Unknown".
 */
function resolveAuthorKey(commit) {
  return (
    commit.author?.login   ||
    commit.author?.name    ||
    commit.commit?.author?.name ||
    "Unknown"
  );
}

function resolveAuthorName(commit) {
  return (
    commit.author?.name    ||
    commit.commit?.author?.name ||
    commit.author?.login   ||
    "Unknown"
  );
}

// ─── Bus Factor Calculator ─────────────────────────────────────────────────────

/**
 * Bus factor = minimum number of contributors whose combined commits
 * account for ≥ 50% of total commits.
 *
 * Lower number  → higher "hit by a bus" risk.
 * E.g. bus factor 1 means one person owns half the codebase.
 *
 * @param {Array<{commits:number}>} sortedDesc - contributors sorted by commits desc
 * @param {number} totalCommits
 * @returns {number}
 */
function calculateBusFactor(sortedDesc, totalCommits) {
  if (totalCommits === 0 || sortedDesc.length === 0) return 0;

  const threshold = totalCommits * 0.5;
  let accumulated = 0;

  for (let i = 0; i < sortedDesc.length; i++) {
    accumulated += sortedDesc[i].commits;
    if (accumulated >= threshold) return i + 1;
  }

  return sortedDesc.length; // edge-case: somehow never reached 50%
}

// ─── Main Entry Point ──────────────────────────────────────────────────────────

/**
 * Processes contributors and commits into enriched analytics.
 *
 * @param {Array}  rawContributors - from github.activity.service getContributors()
 * @param {Array}  rawCommits      - from github.activity.service getCommits()
 * @returns {{
 *   contributors:        Array,
 *   busiestContributor:  Object|null,
 *   busFactor:           number,
 *   totalContributors:   number,
 *   totalCommits:        number,
 *   riskLevel:           "low"|"medium"|"high"
 * }}
 */
function processContributorAnalytics(rawContributors = [], rawCommits = []) {
  if (!Array.isArray(rawContributors) && !Array.isArray(rawCommits)) {
    return {
      contributors: [], busiestContributor: null,
      busFactor: 0, totalContributors: 0,
      totalCommits: 0, riskLevel: "high"
    };
  }

  // ── Step 1: Build a map from commits (login/name → { commits, additions, deletions }) ──
  const commitMap = {};

  for (const commit of rawCommits) {
    const key = resolveAuthorKey(commit);
    if (!commitMap[key]) {
      commitMap[key] = {
        commits:   0,
        additions: 0,
        deletions: 0,
        name:      resolveAuthorName(commit),
        login:     commit.author?.login  || null,
        avatar:    commit.author?.avatar || null,
      };
    }
    commitMap[key].commits++;
    // Handle optional addition/deletion stats (not in basic /commits response — may be enriched later)
    if (commit.stats) {
      commitMap[key].additions += commit.stats.additions || 0;
      commitMap[key].deletions += commit.stats.deletions || 0;
    }
  }

  // ── Step 2: Merge with rawContributors (the /contributors endpoint has commit counts) ──
  // rawContributors gives us an accurate server-side commit count; prefer it.
  for (const contrib of rawContributors) {
    const key = contrib.login || contrib.name || "Unknown";
    if (!commitMap[key]) {
      commitMap[key] = {
        commits:   contrib.contributions || 0,
        additions: 0,
        deletions: 0,
        name:      contrib.login || "Unknown",
        login:     contrib.login || null,
        avatar:    contrib.avatar || null,
      };
    } else {
      // Prefer the /contributors count (authoritative; covers full history)
      commitMap[key].commits   = contrib.contributions || commitMap[key].commits;
      commitMap[key].avatar  ||= contrib.avatar;
      commitMap[key].login   ||= contrib.login;
    }
  }

  // ── Step 3: Build sorted contributors array ────────────────────────────────
  const contributors = Object.entries(commitMap)
    .map(([key, data]) => ({
      name:      data.name || key,
      login:     data.login,
      avatar:    data.avatar,
      commits:   data.commits,
      additions: data.additions,
      deletions: data.deletions,
      impact:    data.commits + data.additions + data.deletions, // composite impact score
    }))
    .sort((a, b) => b.commits - a.commits); // primary sort by commits desc

  // ── Step 4: Totals ─────────────────────────────────────────────────────────
  const totalCommits      = contributors.reduce((sum, c) => sum + c.commits, 0);
  const totalContributors = contributors.length;

  // ── Step 5: Bus factor ─────────────────────────────────────────────────────
  const busFactor = calculateBusFactor(contributors, totalCommits);

  // ── Step 6: Risk level ─────────────────────────────────────────────────────
  let riskLevel;
  if (busFactor <= 1)      riskLevel = "high";   // 1 person owns ≥50%
  else if (busFactor <= 3) riskLevel = "medium"; // 2-3 people own ≥50%
  else                     riskLevel = "low";    // well-distributed

  // ── Step 7: Busiest contributor ────────────────────────────────────────────
  const busiestContributor = contributors.length > 0
    ? {
        ...contributors[0],
        sharePercent: totalCommits > 0
          ? Number(((contributors[0].commits / totalCommits) * 100).toFixed(1))
          : 0,
      }
    : null;

  return {
    contributors,
    busiestContributor,
    busFactor,
    totalContributors,
    totalCommits,
    riskLevel,
  };
}

// ─── Convenience: top N contributors ─────────────────────────────────────────

/**
 * Returns only the top N contributors by commit count.
 * Useful for compact leaderboard widgets.
 */
function getTopContributors(rawContributors, rawCommits, n = 5) {
  const { contributors } = processContributorAnalytics(rawContributors, rawCommits);
  return contributors.slice(0, n);
}

module.exports = {
  processContributorAnalytics,
  getTopContributors,
  calculateBusFactor,
};
