const axios = require("axios");
const connection = require("../config/redis");

/**
 * Common helper to get GitHub API headers.
 * prioritize user token, fallback to app token
 */
const getAuthHeaders = (token) => {
  // Treat empty string / literal "null" / "undefined" as no token
  const finalToken = (token && token.trim() && token !== "null" && token !== "undefined")
    ? token
    : (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim())
    ? process.env.GITHUB_TOKEN
    : null;

  if (!finalToken) return { "Accept": "application/vnd.github+json" };
  return {
    "Authorization": `Bearer ${finalToken}`,
    "Accept": "application/vnd.github+json",
  };
};

/**
 * Helper to parse GitHub Link header for pagination.
 */
function parseLinkHeader(header) {
  if (!header) return {};
  const links = {};
  const parts = header.split(",");
  parts.forEach((p) => {
    const section = p.split(";");
    if (section.length < 2) return;
    const url = section[0].replace(/<(.*)>/, "$1").trim();
    const name = section[1].replace(/rel="(.*)"/, "$1").trim();
    links[name] = url;
  });
  return links;
}

/**
 * Intelligent Caching Wrapper handling offline status and GitHub Rate Limits
 */
async function fetchWithCache(url, options = {}) {
  const { headers, params, forceRefresh = false, ttl = 3600 } = options;
  const urlObj = new URL(url);
  // Remove sensitive tokens from cache keys; strictly map by semantic path & params
  const paramString = new URLSearchParams(params || {}).toString();
  const cacheKey = `github:api:${urlObj.pathname}${paramString ? '?' + paramString : ''}`;

  if (connection) {
    try {
      const globalRate = await connection.get("github:rate_limit_remaining");
      const isNearingLimit = globalRate && parseInt(globalRate, 10) < 50;

      // If we are nearing the threshold, or just doing a standard fetch
      if (!forceRefresh || isNearingLimit) {
        const cached = await connection.get(cacheKey);
        if (cached) return JSON.parse(cached);
      }
    } catch (e) {
      console.warn("Redis cache read error:", e.message);
    }
  }

  try {
    const res = await axios.get(url, { headers, params });
    const rateRemaining = res.headers["x-ratelimit-remaining"];
    
    if (connection && rateRemaining !== undefined) {
      // Update global rate tracker silently
      await connection.set("github:rate_limit_remaining", rateRemaining, "EX", 3600);
    }

    const payload = {
      data: res.data,
      headers: { link: res.headers.link }
    };

    if (connection) {
      await connection.set(cacheKey, JSON.stringify(payload), "EX", ttl);
    }

    return payload;

  } catch (error) {
    const isRateLimitExceeded = error.response?.status === 403 && error.response?.headers?.['x-ratelimit-remaining'] === '0';
    const isNetworkError = !error.response;

    if (isNetworkError || isRateLimitExceeded) {
       const customErr = new Error(isRateLimitExceeded ? "Rate Limit Exceeded" : "Network Offline");
       customErr.isOffline = true;
       throw customErr;
    }
    
    throw error;
  }
}

/**
 * 1. Fetch Repo Metadata
 */
async function getRepoMeta(owner, repo, token, forceRefresh = false) {
  try {
    const response = await fetchWithCache(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: getAuthHeaders(token),
      forceRefresh,
      ttl: 3600 // Static meta updates slowly
    });

    const data = response.data;
    return {
      stars: data.stargazers_count,
      forks: data.forks_count,
      open_issues_count: data.open_issues_count,
      default_branch: data.default_branch,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  } catch (error) {
    if (error.isOffline) throw error;
    return null;
  }
}

/**
 * 2. Fetch Commit Count (Last 30 days, max 3 pages)
 */
async function getCommitCount(owner, repo, token, since, forceRefresh = false) {
  let totalCommits = 0;
  let page = 1;
  const maxPages = 3;

  try {
    while (page <= maxPages) {
      const response = await fetchWithCache(`https://api.github.com/repos/${owner}/${repo}/commits`, {
        headers: getAuthHeaders(token),
        params: {
          per_page: 100,
          since: since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          page: page,
        },
        forceRefresh,
        ttl: 900 // Moderate changing data (15m)
      });

      totalCommits += response.data.length;

      const links = parseLinkHeader(response.headers.link);
      if (!links.next || response.data.length < 100) break;
      page++;
    }
    return totalCommits;
  } catch (error) {
    if (error.isOffline) throw error;
    return null;
  }
}

/**
 * 3. Fetch Issue Stats (Exclude PRs)
 */
async function getIssueStats(owner, repo, token, forceRefresh = false) {
  try {
    const response = await fetchWithCache(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      headers: getAuthHeaders(token),
      params: { state: "all", per_page: 100 },
      forceRefresh,
      ttl: 900 // Moderate changing data (15m)
    });

    const issues = response.data.filter((i) => !i.pull_request);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let open_count = 0;
    let closed_count = 0;
    let stale_count = 0;
    let total_close_time_ms = 0;
    let closed_with_time_count = 0;

    issues.forEach((issue) => {
      if (issue.state === "open") {
        open_count++;
        if (new Date(issue.created_at) < thirtyDaysAgo) {
          stale_count++;
        }
      } else if (issue.state === "closed") {
        closed_count++;
        if (issue.closed_at && issue.created_at) {
          total_close_time_ms += new Date(issue.closed_at) - new Date(issue.created_at);
          closed_with_time_count++;
        }
      }
    });

    const avg_close_time_days =
      closed_with_time_count > 0
        ? Math.round(total_close_time_ms / (closed_with_time_count * 24 * 60 * 60 * 1000))
        : 0;

    return {
      open_count,
      closed_count,
      stale_count,
      avg_close_time_days,
    };
  } catch (error) {
    if (error.isOffline) throw error;
    return null;
  }
}

/**
 * 4. Fetch PR Stats
 */
async function getPRStats(owner, repo, token, forceRefresh = false) {
  try {
    const response = await fetchWithCache(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      headers: getAuthHeaders(token),
      params: { state: "all", per_page: 100 },
      forceRefresh,
      ttl: 900 // Moderate changing data (15m)
    });

    const pulls = response.data;
    let open_count = 0;
    let merged_count = 0;
    let closed_count = 0;

    pulls.forEach((pr) => {
      if (pr.state === "open") {
        open_count++;
      } else if (pr.merged_at) {
        merged_count++;
      } else {
        closed_count++;
      }
    });

    return {
      open_count,
      merged_count,
      closed_count,
    };
  } catch (error) {
    if (error.isOffline) throw error;
    return null;
  }
}

/**
 * 5. Fetch Contributor Count (Efficiently via Link header)
 */
async function getContributorCount(owner, repo, token, forceRefresh = false) {
  try {
    const response = await fetchWithCache(`https://api.github.com/repos/${owner}/${repo}/contributors`, {
      headers: getAuthHeaders(token),
      params: { per_page: 1, anon: "true" },
      forceRefresh,
      ttl: 3600 // High-level count changes slowly
    });

    const links = parseLinkHeader(response.headers.link);
    if (links.last) {
      const url = new URL(links.last);
      return parseInt(url.searchParams.get("page"), 10);
    }

    return response.data.length;
  } catch (error) {
    if (error.isOffline) throw error;
    return null;
  }
}

/**
 * 6. Fetch Recent Issues Details
 */
async function getRecentIssues(owner, repo, token, limit = 10, forceRefresh = false) {
  try {
    const response = await fetchWithCache(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      headers: getAuthHeaders(token),
      params: { state: "all", sort: "created", direction: "desc", per_page: limit },
      forceRefresh,
      ttl: 300 // Changing data
    });
    
    const now = new Date();
    return response.data.map(i => ({
      number: i.number,
      title: i.title,
      state: i.state,
      created_at: i.created_at,
      is_stale: i.state === "open" && new Date(i.updated_at) < new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }));
  } catch (error) {
    if (error.isOffline) throw error;
    return [];
  }
}

/**
 * 7. Fetch Recent Commits Details
 */
async function getRecentCommits(owner, repo, token, limit = 10, forceRefresh = false) {
  try {
    const response = await fetchWithCache(`https://api.github.com/repos/${owner}/${repo}/commits`, {
      headers: getAuthHeaders(token),
      params: { per_page: limit },
      forceRefresh,
      ttl: 300 // Changing data
    });
    
    return response.data.map(c => ({
      sha: c.sha,
      message: c.commit.message,
      author: c.commit.author?.name || c.author?.login || "Unknown",
      date: c.commit.author?.date
    }));
  } catch (error) {
    if (error.isOffline) throw error;
    return [];
  }
}

/**
 * 8. Fetch Unified Repo Metrics
 */
async function getRepoMetrics(owner, repo, token, forceRefresh = false) {
  const headers = getAuthHeaders(token);

  // 1. Repo Meta (Stars, Forks, Watchers) — wrapped so 403/404 returns partial zeros
  let repoMeta = {};
  try {
    const repoRes = await fetchWithCache(`https://api.github.com/repos/${owner}/${repo}`, { 
      headers, forceRefresh, ttl: 3600
    });
    repoMeta = repoRes.data;
  } catch (e) {
    if (e.isOffline) throw e;
    const status = e.response?.status;
    console.warn(`[getRepoMetrics] Repo meta fetch failed (${status}): ${e.message}`);
  }

  try {

    // 2. Contributors
    let contributorsCount = 0;
    try {
      const contRes = await fetchWithCache(`https://api.github.com/repos/${owner}/${repo}/contributors`, {
        headers,
        params: { per_page: 1, anon: "true" },
        forceRefresh, ttl: 3600
      });
      const links = parseLinkHeader(contRes.headers.link);
      if (links.last) {
        const url = new URL(links.last);
        contributorsCount = parseInt(url.searchParams.get("page"), 10);
      } else {
        contributorsCount = contRes.data.length;
      }
    } catch (e) {
      if (e.isOffline) throw e;
    }

    // 3. Commits 
    let commitsCount = 0;
    try {
      const commitRes = await fetchWithCache(`https://api.github.com/repos/${owner}/${repo}/commits`, {
        headers,
        params: { per_page: 1 },
        forceRefresh, ttl: 900
      });
      const links = parseLinkHeader(commitRes.headers.link);
      if (links.last) {
        const url = new URL(links.last);
        commitsCount = parseInt(url.searchParams.get("page"), 10);
      } else {
        commitsCount = commitRes.data.length;
      }
    } catch (e) {
      if (e.isOffline) throw e;
    }

    // 4. Issues 
    let issuesOpen = repoMeta.open_issues_count || 0;
    let issuesClosed = 0;
    try {
      const closedIssueRes = await fetchWithCache(`https://api.github.com/repos/${owner}/${repo}/issues`, {
        headers,
        params: { state: "closed", per_page: 1 },
        forceRefresh, ttl: 900
      });
      const links = parseLinkHeader(closedIssueRes.headers.link);
      if (links.last) {
        const url = new URL(links.last);
        issuesClosed = parseInt(url.searchParams.get("page"), 10);
      } else {
        issuesClosed = closedIssueRes.data.length;
      }
    } catch (e) {
      if (e.isOffline) throw e;
    }

    // 5. Traffic (Views & Clones) - High Frequency (5 mins)
    let views = 0, uniqueVisitors = 0, clones = 0;
    if (token) {
      try {
        const [viewsRes, clonesRes] = await Promise.all([
          fetchWithCache(`https://api.github.com/repos/${owner}/${repo}/traffic/views`, { headers, forceRefresh, ttl: 300 }),
          fetchWithCache(`https://api.github.com/repos/${owner}/${repo}/traffic/clones`, { headers, forceRefresh, ttl: 300 })
        ]);
        views = viewsRes.data.count || 0;
        uniqueVisitors = viewsRes.data.uniques || 0;
        clones = clonesRes.data.count || 0;
      } catch (e) {
        if (e.isOffline) throw e;
      }
    }

    return {
      stars: repoMeta.stargazers_count || 0,
      forks: repoMeta.forks_count || 0,
      watchers: repoMeta.subscribers_count || repoMeta.watchers_count || 0,
      contributorsCount,
      commitsCount,
      issues: {
        open: issuesOpen,
        closed: issuesClosed
      },
      traffic: {
        views,
        uniqueVisitors,
        clones
      }
    };
  } catch (error) {
    if (error.isOffline) throw error;
    console.error("[getRepoMetrics] Unexpected error:", error.message);
    return {
      stars: 0, forks: 0, watchers: 0,
      contributorsCount: 0, commitsCount: 0,
      issues: { open: 0, closed: 0 },
      traffic: { views: 0, uniqueVisitors: 0, clones: 0 },
      _partial: true
    };
  }
}

module.exports = {
  getAuthHeaders,
  parseLinkHeader,
  fetchWithCache,
  getRepoMeta,
  getCommitCount,
  getIssueStats,
  getPRStats,
  getContributorCount,
  getRecentIssues,
  getRecentCommits,
  getRepoMetrics
};
