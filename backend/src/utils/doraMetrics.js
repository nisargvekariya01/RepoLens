/**
 * DORA Metrics Calculator
 *
 * Implements the four DORA (DevOps Research and Assessment) metrics:
 *   1. Deployment Frequency
 *   2. Lead Time for Changes
 *   3. Change Failure Rate
 *   4. Time to Restore Service
 *
 * ASSUMPTIONS (documented per DORA spec):
 *   - No formal deployment pipeline is assumed.
 *   - A "deployment" is approximated as a merged PR to the default branch.
 *   - "Lead time" = duration from the oldest commit in a PR to its merge.
 *   - "Change failure" = merged PRs that were followed by a bug-related issue
 *     opened within 48 h after the merge (approximation; real data needs CI/CD events).
 *   - "Time to restore" = time to close a bug issue after it was opened.
 *   - All time values are in hours unless noted.
 */

const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_DAY  = MS_PER_HOUR * 24;

// ─── Label matchers ────────────────────────────────────────────────────────────

const BUG_LABELS = ["bug", "defect", "fix", "error", "regression", "incident", "hotfix", "crash"];

function isBugIssue(issue) {
  if (!Array.isArray(issue.labels)) return false;
  return issue.labels.some((l) => {
    const name = (typeof l === "string" ? l : l?.name || "").toLowerCase();
    return BUG_LABELS.some((b) => name.includes(b));
  });
}

// ─── Date helpers ──────────────────────────────────────────────────────────────

function toMs(dateStr) {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  return isNaN(t) ? null : t;
}

function hoursBetween(start, end) {
  const s = toMs(start);
  const e = toMs(end);
  if (s === null || e === null || e <= s) return null;
  return (e - s) / MS_PER_HOUR;
}

function average(values) {
  const valid = values.filter((v) => v !== null && !isNaN(v));
  if (valid.length === 0) return 0;
  return Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2));
}

// ─── DORA Metric 1: Deployment Frequency ─────────────────────────────────────

/**
 * ASSUMPTION: Each merged PR = one deployment.
 *
 * We count how many merges occurred in the observed window
 * (from earliest to latest merge) and express it as merges/day.
 *
 * Elite: ≥ 1/day | High: ≥ 1/week | Medium: ≥ 1/month | Low: < 1/month
 *
 * @param {Array}  mergedPRs - pull requests where merged === true
 * @param {number} windowDays - fallback window if no PR history (default 30)
 * @returns {number} deployments per day (rounded to 2dp)
 */
function calcDeploymentFrequency(mergedPRs, windowDays = 30) {
  if (!mergedPRs.length) return 0;

  const timestamps = mergedPRs
    .map((pr) => toMs(pr.mergedAt))
    .filter(Boolean)
    .sort((a, b) => a - b);

  if (timestamps.length === 0) return 0;

  // Use real observed window if we have at least 2 data points
  const spanMs = timestamps.length > 1
    ? timestamps[timestamps.length - 1] - timestamps[0]
    : windowDays * MS_PER_DAY;

  const spanDays = Math.max(spanMs / MS_PER_DAY, 1);
  return Number((mergedPRs.length / spanDays).toFixed(2));
}

// ─── DORA Metric 2: Lead Time for Changes ────────────────────────────────────

/**
 * ASSUMPTION: Lead time = time from the first commit in a PR to its merge.
 *
 * Since the basic /pulls API doesn't return commits, we approximate using:
 *   mergedAt - createdAt   (PR creation is a proxy for "first related commit pushed")
 *
 * If enriched commit data is provided (array of commits keyed by PR branch),
 * this can be improved by finding the oldest commit SHA in the PR diff.
 * For now, createdAt is sufficiently accurate for trend comparison.
 *
 * Elite: < 1 h | High: < 1 day | Medium: < 1 week | Low: > 1 week
 *
 * @param {Array} mergedPRs
 * @returns {number} average lead time in hours
 */
function calcLeadTimeForChanges(mergedPRs) {
  const leadTimes = mergedPRs.map((pr) => hoursBetween(pr.createdAt, pr.mergedAt));
  return average(leadTimes);
}

// ─── DORA Metric 3: Change Failure Rate ──────────────────────────────────────

/**
 * ASSUMPTION: A "failed deployment" is a merged PR that was followed by a
 * bug-labelled issue opened within 48 hours of the merge.
 *
 * This is a heuristic — real CFR requires CI/CD event data.
 * Expressed as a percentage: (failed deployments / total deployments) × 100.
 *
 * Elite: 0–5% | High: 5–10% | Medium: 10–15% | Low: >15%
 *
 * @param {Array} mergedPRs
 * @param {Array} issues       - all issues (from github.activity.service)
 * @param {number} windowHours - how far after a merge to look for bugs (default 48 h)
 * @returns {number} failure rate as a percentage (0-100)
 */
function calcChangeFailureRate(mergedPRs, issues, windowHours = 48) {
  if (!mergedPRs.length) return 0;

  const bugIssues = issues
    .filter((i) => isBugIssue(i) && i.createdAt)
    .map((i) => toMs(i.createdAt))
    .filter(Boolean);

  let failedDeployments = 0;

  for (const pr of mergedPRs) {
    const mergeMs = toMs(pr.mergedAt);
    if (!mergeMs) continue;

    const windowEnd = mergeMs + windowHours * MS_PER_HOUR;

    // Was a bug opened in the 48 h window after this merge?
    const hadFailure = bugIssues.some(
      (bugMs) => bugMs >= mergeMs && bugMs <= windowEnd
    );

    if (hadFailure) failedDeployments++;
  }

  return Number(((failedDeployments / mergedPRs.length) * 100).toFixed(1));
}

// ─── DORA Metric 4: Time to Restore Service ──────────────────────────────────

/**
 * ASSUMPTION: Restore time = time to close a bug-labelled issue after it opened.
 *
 * Only closed bug issues are counted (open ones haven't been "restored" yet).
 *
 * Elite: < 1 h | High: < 1 day | Medium: < 1 week | Low: > 1 week
 *
 * @param {Array} issues
 * @returns {number} average restore time in hours
 */
function calcTimeToRestore(issues) {
  const closedBugs = issues.filter(
    (i) => isBugIssue(i) && i.state === "closed" && i.createdAt && i.closedAt
  );

  const restoreTimes = closedBugs.map((i) => hoursBetween(i.createdAt, i.closedAt));
  return average(restoreTimes);
}

// ─── Performance Band Classifier ─────────────────────────────────────────────

/**
 * Maps each DORA metric value to an Elite / High / Medium / Low band.
 * Based on the 2023 DORA State of DevOps Report thresholds.
 */
function classifyPerformance(metrics) {
  const { deploymentFrequency, leadTimeForChangesHours, changeFailureRate, timeToRestoreServiceHours } = metrics;

  return {
    deploymentFrequency: deploymentFrequency >= 1    ? "Elite"
                       : deploymentFrequency >= 1/7  ? "High"
                       : deploymentFrequency >= 1/30 ? "Medium"
                       : "Low",

    leadTime: leadTimeForChangesHours <= 1    ? "Elite"
            : leadTimeForChangesHours <= 24   ? "High"
            : leadTimeForChangesHours <= 168  ? "Medium"  // 1 week
            : "Low",

    changeFailureRate: changeFailureRate <= 5  ? "Elite"
                     : changeFailureRate <= 10 ? "High"
                     : changeFailureRate <= 15 ? "Medium"
                     : "Low",

    timeToRestore: timeToRestoreServiceHours <= 1    ? "Elite"
                 : timeToRestoreServiceHours <= 24   ? "High"
                 : timeToRestoreServiceHours <= 168  ? "Medium"
                 : "Low",
  };
}

// ─── Main Entry Point ──────────────────────────────────────────────────────────

/**
 * @param {Array}  commits      - from github.activity.service getCommits()
 * @param {Array}  pullRequests - from github.activity.service getPullRequests()
 * @param {Array}  issues       - from github.activity.service getIssues()
 * @param {Array}  deployments  - optional formal deployment records (not used in approximation mode)
 * @param {Object} opts         - { windowDays, cfr_windowHours }
 */
function calculateDoraMetrics(commits = [], pullRequests = [], issues = [], deployments = [], opts = {}) {
  const { windowDays = 30, cfr_windowHours = 48 } = opts;

  const mergedPRs = pullRequests.filter((pr) => pr.merged || pr.mergedAt);

  // ── If formal deployment records are provided, use them for frequency ──────
  // ASSUMPTION: deployment record has { deployedAt: ISO string }
  const deploymentEvents = Array.isArray(deployments) && deployments.length > 0
    ? deployments
    : mergedPRs; // fallback to merged PRs

  const deploymentFrequency     = calcDeploymentFrequency(deploymentEvents, windowDays);
  const leadTimeForChangesHours = calcLeadTimeForChanges(mergedPRs);
  const changeFailureRate       = calcChangeFailureRate(mergedPRs, issues, cfr_windowHours);
  const timeToRestoreServiceHours = calcTimeToRestore(issues);

  const metrics = {
    deploymentFrequency,
    leadTimeForChangesHours,
    changeFailureRate,
    timeToRestoreServiceHours,
  };

  return {
    ...metrics,
    performance: classifyPerformance(metrics),

    // Context metadata
    meta: {
      mergedPRsAnalyzed:      mergedPRs.length,
      totalPRs:               pullRequests.length,
      bugIssuesAnalyzed:      issues.filter(isBugIssue).length,
      totalIssues:            issues.length,
      commitsProvided:        commits.length,
      usingFormalDeployments: deployments.length > 0,
    },
  };
}

module.exports = {
  calculateDoraMetrics,
  calcDeploymentFrequency,
  calcLeadTimeForChanges,
  calcChangeFailureRate,
  calcTimeToRestore,
  classifyPerformance,
  isBugIssue,
};
