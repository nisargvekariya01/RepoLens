const { getAuthHeaders, parseLinkHeader, fetchWithCache } = require("./github.service");

/**
 * Fetch star history and group by date.
 * Note: Uses several pages to approximate the timeline for the last 365 days.
 */
async function getStarsHistory(owner, repo, token) {
  const starsByDate = {};
  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  
  const headers = getAuthHeaders(token);
  // Special header to get starred_at timestamps
  headers["Accept"] = "application/vnd.github.v3.star+json";

  try {
    // 1. Fetch the first page to get the 'last' page link from headers
    const firstResponse = await fetchWithCache(`https://api.github.com/repos/${owner}/${repo}/stargazers`, {
      headers,
      params: { per_page: 100, page: 1 },
      ttl: 1800 // 30 mins
    });

    const links = parseLinkHeader(firstResponse.headers.link);
    let lastPage = 1;
    
    if (links.last) {
      const url = new URL(links.last);
      lastPage = parseInt(url.searchParams.get("page"), 10);
    }

    // 2. Iterate backwards from the last page to get the newest stargazers first
    let page = lastPage;
    const minPage = Math.max(1, lastPage - 10); // Fetch up to 10 pages (~1000 newest stars)

    while (page >= minPage) {
      let stargazers;
      
      // Reuse the first response if the last page is 1
      if (page === 1 && lastPage === 1) {
        stargazers = firstResponse.data;
      } else {
        const response = await fetchWithCache(`https://api.github.com/repos/${owner}/${repo}/stargazers`, {
          headers,
          params: { per_page: 100, page: page },
          ttl: 1800
        });
        stargazers = response.data;
      }

      if (!stargazers || stargazers.length === 0) break;

      let reachedLimit = false;
      // Iterate the page array backwards (newest in the page are at the end)
      for (let i = stargazers.length - 1; i >= 0; i--) {
        const star = stargazers[i];
        const starDate = new Date(star.starred_at);
        
        if (starDate < yearAgo) {
          reachedLimit = true;
          break; // Hit a star older than a year, we can stop entirely
        }

        const dateStr = starDate.toISOString().split('T')[0];
        starsByDate[dateStr] = (starsByDate[dateStr] || 0) + 1;
      }

      if (reachedLimit) break;
      page--;
    }

    return Object.entries(starsByDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error(`[getStarsHistory] error:`, error.message);
    return [];
  }
}

/**
 * Fetch commits history and group by date.
 */
async function getCommitsHistory(owner, repo, token) {
  const commitsByDate = {};
  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);

  let page = 1;
  const maxPages = 10;
  const headers = getAuthHeaders(token);

  try {
    while (page <= maxPages) {
      const response = await fetchWithCache(`https://api.github.com/repos/${owner}/${repo}/commits`, {
        headers,
        params: { 
          per_page: 100, 
          page: page,
          since: yearAgo.toISOString()
        },
        ttl: 1800 // 30 mins
      });

      const commits = response.data;
      if (!commits || commits.length === 0) break;

      for (const commitObj of commits) {
        const commitDate = new Date(commitObj.commit.author.date);
        const dateStr = commitDate.toISOString().split('T')[0];
        commitsByDate[dateStr] = (commitsByDate[dateStr] || 0) + 1;
      }

      const links = parseLinkHeader(response.headers.link);
      if (!links.next) break;
      page++;
    }

    return Object.entries(commitsByDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error(`[getCommitsHistory] error:`, error.message);
    return [];
  }
}

/**
 * Fetch raw repo events.
 */
async function getRepoEvents(owner, repo, token) {
  try {
    const response = await fetchWithCache(`https://api.github.com/repos/${owner}/${repo}/events`, {
      headers: getAuthHeaders(token),
      params: { per_page: 100 },
      ttl: 300 // 5 mins
    });
    return response.data;
  } catch (error) {
    console.error(`[getRepoEvents] error:`, error.message);
    return [];
  }
}

module.exports = {
  getStarsHistory,
  getCommitsHistory,
  getRepoEvents
};
