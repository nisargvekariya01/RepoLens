const { fetchWithCache, getAuthHeaders } = require("./github.service");

// ─── Link header pagination helper ────────────────────────────────────────────
function getNextPageUrl(linkHeader) {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

/**
 * Generic paginated fetcher utilizing heavily cached retrieval logic.
 */
async function fetchAllPages(url, headers, params = {}, maxPages = 10, ttl = 3600) {
  const results = [];
  let nextUrl = url;
  let page = 0;

  while (nextUrl && page < maxPages) {
    const res = await fetchWithCache(nextUrl, {
      headers,
      params: page === 0 ? { per_page: 100, ...params } : undefined,
      ttl // Expiry caching bounds wrapper
    });

    results.push(...res.data);
    nextUrl = getNextPageUrl(res.headers?.link);
    page++;
  }

  return results;
}

// ─── 1. Get Commits ────────────────────────────────────────────────────────────
/**
 * Returns cleaned commit records for a repository.
 * Sorted newest-first (GitHub default).
 * @param {string} owner
 * @param {string} repo
 * @param {string|null} token  - User GitHub OAuth token (optional)
 * @param {Object} opts        - { since, until, author, maxPages }
 */
async function getCommits(owner, repo, token = null, opts = {}) {
  const headers = getAuthHeaders(token);
  const { since, until, author, maxPages = 10 } = opts;

  const params = {};
  if (since) params.since = since;
  if (until) params.until = until;
  if (author) params.author = author;

  const raw = await fetchAllPages(
    `https://api.github.com/repos/${owner}/${repo}/commits`,
    headers,
    params,
    maxPages,
    1800 // High volatility ~ 30 minutes
  );

  return raw.map((c) => ({
    sha: c.sha,
    shortSha: c.sha.slice(0, 7),
    message: c.commit.message.split("\n")[0], // first line only
    author: {
      name: c.commit.author?.name || null,
      email: c.commit.author?.email || null,
      login: c.author?.login || null,
      avatar: c.author?.avatar_url || null,
    },
    date: c.commit.author?.date || null,
    url: c.html_url,
  }));
}

// ─── 2. Get Contributors ───────────────────────────────────────────────────────
/**
 * Returns contributors sorted by commit count (GitHub default = descending).
 */
async function getContributors(owner, repo, token = null, opts = {}) {
  const headers = getAuthHeaders(token);
  const { maxPages = 5 } = opts;

  const raw = await fetchAllPages(
    `https://api.github.com/repos/${owner}/${repo}/contributors`,
    headers,
    { anon: "true" },
    maxPages,
    3600 // Low volatility ~ 1 Hour
  );

  return raw.map((c) => ({
    login: c.login || null,
    avatar: c.avatar_url || null,
    profileUrl: c.html_url || null,
    contributions: c.contributions,
    type: c.type || "User", // "User" | "Anonymous" | "Bot"
  }));
}

// ─── 3. Get Pull Requests ──────────────────────────────────────────────────────
/**
 * Returns all PRs (open + closed + merged).
 */
async function getPullRequests(owner, repo, token = null, opts = {}) {
  const headers = getAuthHeaders(token);
  const { state = "all", maxPages = 10 } = opts;

  const raw = await fetchAllPages(
    `https://api.github.com/repos/${owner}/${repo}/pulls`,
    headers,
    { state },
    maxPages,
    1800 // 30 minutes
  );

  return raw.map((pr) => ({
    number: pr.number,
    title: pr.title,
    state: pr.state,
    merged: !!pr.merged_at,
    draft: pr.draft,
    author: {
      login: pr.user?.login || null,
      avatar: pr.user?.avatar_url || null,
    },
    labels: pr.labels?.map((l) => l.name) || [],
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    closedAt: pr.closed_at,
    mergedAt: pr.merged_at,
    url: pr.html_url,
    reviewers: pr.requested_reviewers?.map((r) => r.login) || [],
    changedFiles: pr.changed_files ?? null,
    additions: pr.additions ?? null,
    deletions: pr.deletions ?? null,
  }));
}

// ─── 4. Get Issues ─────────────────────────────────────────────────────────────
/**
 * Returns all issues (excluding PRs which GitHub lumps in /issues).
 */
async function getIssues(owner, repo, token = null, opts = {}) {
  const headers = getAuthHeaders(token);
  const { state = "all", maxPages = 10, labels, since } = opts;

  const params = { state };
  if (labels) params.labels = labels;
  if (since) params.since = since;

  const raw = await fetchAllPages(
    `https://api.github.com/repos/${owner}/${repo}/issues`,
    headers,
    params,
    maxPages,
    1800 // 30 mins
  );

  // GitHub /issues returns PRs too — filter them out
  const issues = raw.filter((i) => !i.pull_request);

  return issues.map((i) => ({
    number: i.number,
    title: i.title,
    state: i.state,
    author: {
      login: i.user?.login || null,
      avatar: i.user?.avatar_url || null,
    },
    labels: i.labels?.map((l) => ({ name: l.name, color: l.color })) || [],
    assignees: i.assignees?.map((a) => a.login) || [],
    comments: i.comments,
    createdAt: i.created_at,
    updatedAt: i.updated_at,
    closedAt: i.closed_at,
    url: i.html_url,
    isStale:
      i.state === "open" &&
      new Date(i.updated_at) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  }));
}

module.exports = {
  getCommits,
  getContributors,
  getPullRequests,
  getIssues,
};
