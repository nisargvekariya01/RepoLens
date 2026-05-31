/**
 * Commit Analytics Processor
 * Transforms a raw commits[] array into chart-ready analytics data.
 */

// ─── Date Normalizers ──────────────────────────────────────────────────────────

/** Returns "YYYY-MM-DD" */
function toDay(dateStr) {
  return new Date(dateStr).toISOString().slice(0, 10);
}

/** Returns "YYYY-WW" (ISO week number) */
function toWeek(dateStr) {
  const d = new Date(dateStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Returns "YYYY-MM" */
function toMonth(dateStr) {
  return new Date(dateStr).toISOString().slice(0, 7);
}

// ─── Increment counter in a plain object ─────────────────────────────────────
function increment(map, key, by = 1) {
  map[key] = (map[key] || 0) + by;
}

// ─── Sort a map's entries by key ascending → [{ key, value }] ────────────────
function sortedEntries(map) {
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b));
}

// ─── Main Entry Point ──────────────────────────────────────────────────────────

/**
 * Processes a commits array into analytics data structures.
 *
 * @param {Array}  commits  - Cleaned commits from github.activity.service.js
 * @param {Object} opts
 * @param {"day"|"week"|"month"} opts.granularity - Time grouping (default: "day")
 * @returns {{
 *   commitsOverTime: Array<{date:string, count:number}>,
 *   commitsByAuthor: Array<{author:string, commits:number}>,
 *   heatmap:         Array<{date:string, count:number}>
 * }}
 */
function processCommitAnalytics(commits = [], opts = {}) {
  const { granularity = "day" } = opts;

  if (!Array.isArray(commits) || commits.length === 0) {
    return { commitsOverTime: [], commitsByAuthor: [], heatmap: [] };
  }

  const timeMap   = {}; // bucketed by granularity
  const authorMap = {}; // login or name → count
  const heatMap   = {}; // always daily for heatmap resolution

  for (const commit of commits) {
    const rawDate = commit.date || commit.commit?.author?.date;
    if (!rawDate) continue;

    // ── Time grouping ──────────────────────────────────────────────────────
    let bucket;
    if (granularity === "week")       bucket = toWeek(rawDate);
    else if (granularity === "month") bucket = toMonth(rawDate);
    else                              bucket = toDay(rawDate);

    increment(timeMap, bucket);

    // ── Author grouping ─────────────────────────────────────────────────────
    // Prefer login (unique), fallback to name
    const authorKey =
      commit.author?.login ||
      commit.author?.name  ||
      commit.commit?.author?.name  ||
      "Unknown";

    increment(authorMap, authorKey);

    // ── Heatmap (always daily) ──────────────────────────────────────────────
    increment(heatMap, toDay(rawDate));
  }

  // ── Format: commitsOverTime ────────────────────────────────────────────────
  const commitsOverTime = sortedEntries(timeMap).map(([date, count]) => ({
    date,
    count,
  }));

  // ── Format: commitsByAuthor (sorted by commit count desc) ─────────────────
  const commitsByAuthor = Object.entries(authorMap)
    .map(([author, commits]) => ({ author, commits }))
    .sort((a, b) => b.commits - a.commits);

  // ── Format: heatmap ────────────────────────────────────────────────────────
  // Fill in zero-days between first commit and last commit for contiguous data
  const heatmap = buildContiguousHeatmap(heatMap);

  return { commitsOverTime, commitsByAuthor, heatmap };
}

/**
 * Fills gaps in the heatmap so charting libraries get a contiguous date array.
 * Generates the last 365 days ending today, padded at the start so the array
 * begins on a Sunday. This ensures a 7-row CSS grid flows correctly.
 */
function buildContiguousHeatmap(heatMap) {
  const result = [];
  const end = new Date();
  end.setHours(0, 0, 0, 0); // End of range is today
  
  const start = new Date(end);
  start.setDate(end.getDate() - 364); // 365 days total

  // Pad the beginning so the first element is Sunday (0)
  const startDayOfWeek = start.getDay();
  for (let i = 0; i < startDayOfWeek; i++) {
    result.push({ date: null, count: 0 }); // Empty placeholder
  }

  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    result.push({ date: dateStr, count: heatMap[dateStr] || 0 });
    current.setDate(current.getDate() + 1);
  }

  return result;
}

// ─── Optional: Granularity breakdown helper ────────────────────────────────────

/**
 * Returns commitsOverTime for multiple granularities at once.
 * Useful if the frontend supports a granularity switcher.
 *
 * @returns {{ daily, weekly, monthly }}
 */
function processAllGranularities(commits = []) {
  return {
    daily:   processCommitAnalytics(commits, { granularity: "day"   }).commitsOverTime,
    weekly:  processCommitAnalytics(commits, { granularity: "week"  }).commitsOverTime,
    monthly: processCommitAnalytics(commits, { granularity: "month" }).commitsOverTime,
  };
}

module.exports = {
  processCommitAnalytics,
  processAllGranularities,
  buildContiguousHeatmap,
  // export normalizers so they can be reused elsewhere
  toDay,
  toWeek,
  toMonth,
};
