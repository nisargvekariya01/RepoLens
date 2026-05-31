/**
 * PR & Issue Analytics Processor
 * Computes review time, cycle time, close time, and ratio metrics.
 */

// ─── Time Helpers ──────────────────────────────────────────────────────────────

const MS_PER_HOUR = 1000 * 60 * 60;

/**
 * Returns hours between two ISO timestamp strings.
 * Returns null if either value is missing or invalid.
 */
function hoursBetween(startStr, endStr) {
  if (!startStr || !endStr) return null;
  const start = new Date(startStr).getTime();
  const end   = new Date(endStr).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return null;
  return (end - start) / MS_PER_HOUR;
}

/**
 * Returns the arithmetic mean of a numeric array, rounded to 1dp.
 * Ignores null/undefined/NaN values.
 * Returns 0 if no valid numbers exist.
 */
function average(values) {
  const valid = values.filter((v) => v !== null && v !== undefined && !isNaN(v));
  if (valid.length === 0) return 0;
  return Number((valid.reduce((sum, v) => sum + v, 0) / valid.length).toFixed(1));
}

// ─── PR Analytics ──────────────────────────────────────────────────────────────

/**
 * Cycle time  = time from PR creation → merge/close
 * Review time = approximated as time from creation → close (no review event in basic API)
 *
 * For repos that return `created_at` + `merged_at` / `closed_at` in cleaned data.
 */
function processPullRequests(pullRequests = []) {
  if (!Array.isArray(pullRequests) || pullRequests.length === 0) {
    return {
      total: 0,
      merged: 0,
      open: 0,
      closed: 0,
      mergeRate: 0,
      avgReviewTimeHours: 0,
      avgCycleTimeHours: 0,
    };
  }

  let merged = 0;
  let open   = 0;
  let closed = 0; // closed but not merged (rejected)

  const cycleTimes  = []; // creation → merged_at or closed_at
  const reviewTimes = []; // creation → closed_at (proxy for review time)

  for (const pr of pullRequests) {
    // ── State counts ──────────────────────────────────────────────────────────
    const isMerged = pr.merged || !!pr.mergedAt;
    if (pr.state === "open") {
      open++;
    } else if (isMerged) {
      merged++;
    } else {
      closed++; // closed/rejected without merge
    }

    // ── Cycle time: creation → merge ─────────────────────────────────────────
    if (isMerged) {
      const ct = hoursBetween(pr.createdAt, pr.mergedAt);
      if (ct !== null) cycleTimes.push(ct);
    }

    // ── Review time proxy: creation → close ──────────────────────────────────
    // Real review time needs /pulls/:n/reviews — not in basic API.
    // We approximate as PR open-to-close duration.
    const closedAt = pr.mergedAt || pr.closedAt;
    const rt = hoursBetween(pr.createdAt, closedAt);
    if (rt !== null) reviewTimes.push(rt);
  }

  const total     = pullRequests.length;
  const mergeRate = total > 0 ? Number(((merged / total) * 100).toFixed(1)) : 0;

  return {
    total,
    merged,
    open,
    closed,
    mergeRate,                             // % of PRs that were merged
    avgReviewTimeHours: average(reviewTimes),
    avgCycleTimeHours:  average(cycleTimes),
  };
}

// ─── Issue Analytics ───────────────────────────────────────────────────────────

// Labels commonly used for bug reports and features
const BUG_LABELS     = ["bug", "defect", "fix", "error", "regression", "crash"];
const FEATURE_LABELS = ["feature", "enhancement", "feat", "new", "improvement", "request"];

function hasLabel(issue, targetLabels) {
  if (!Array.isArray(issue.labels)) return false;
  return issue.labels.some((l) => {
    const name = (typeof l === "string" ? l : l?.name || "").toLowerCase();
    return targetLabels.some((t) => name.includes(t));
  });
}

/**
 * bugToFeatureRatio:
 *   0   => no bugs
 *   1   => equal bugs and features
 *   >1  => more bugs than features (concerning)
 *   Infinity-like => bugs exist but no feature requests (returned as -1 sentinel)
 */
function calcBugToFeatureRatio(bugCount, featureCount) {
  if (bugCount === 0) return 0;
  if (featureCount === 0) return -1; // bugs but no features labelledced
  return Number((bugCount / featureCount).toFixed(2));
}

function processIssues(issues = []) {
  if (!Array.isArray(issues) || issues.length === 0) {
    return {
      total: 0,
      open: 0,
      closed: 0,
      stale: 0,
      avgTimeToCloseHours: 0,
      bugCount: 0,
      featureCount: 0,
      bugToFeatureRatio: 0,
    };
  }

  let open   = 0;
  let closed = 0;
  let stale  = 0;
  let bugs   = 0;
  let features = 0;

  const closeTimes = [];

  for (const issue of issues) {
    // ── State ──────────────────────────────────────────────────────────────────
    if (issue.state === "open") {
      open++;
      if (issue.isStale) stale++;
    } else {
      closed++;
    }

    // ── Time to close ──────────────────────────────────────────────────────────
    if (issue.state === "closed") {
      const ttc = hoursBetween(issue.createdAt, issue.closedAt);
      if (ttc !== null) closeTimes.push(ttc);
    }

    // ── Label classification ───────────────────────────────────────────────────
    if (hasLabel(issue, BUG_LABELS))     bugs++;
    if (hasLabel(issue, FEATURE_LABELS)) features++;
  }

  return {
    total:    issues.length,
    open,
    closed,
    stale,
    avgTimeToCloseHours: average(closeTimes),
    bugCount:            bugs,
    featureCount:        features,
    bugToFeatureRatio:   calcBugToFeatureRatio(bugs, features),
  };
}

// ─── Combined Entry Point ──────────────────────────────────────────────────────

/**
 * Processes PRs and issues together into a unified analytics object.
 *
 * @param {Array} pullRequests - from github.activity.service getPullRequests()
 * @param {Array} issues       - from github.activity.service getIssues()
 * @returns {{ pullRequests: Object, issues: Object }}
 */
function processPrIssueAnalytics(pullRequests = [], issues = []) {
  return {
    pullRequests: processPullRequests(pullRequests),
    issues:       processIssues(issues),
  };
}

module.exports = {
  processPrIssueAnalytics,
  processPullRequests,
  processIssues,
  hoursBetween,
  average,
};
