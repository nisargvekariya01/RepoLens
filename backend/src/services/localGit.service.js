const { execSync } = require('child_process');
const fs = require('fs');

/**
 * Executes a basic git command within the specified local directory context.
 * Bypasses network entirety for instantaneous parsing.
 */
function runGitCmd(localPath, cmd) {
  try {
    return execSync(cmd, { cwd: localPath, stdio: 'pipe' }).toString().trim();
  } catch (error) {
    return null;
  }
}

async function getRepoMeta(localPath) {
  let createdAt = new Date().toISOString(); 
  try {
    const stat = fs.statSync(localPath);
    createdAt = stat.birthtime.toISOString();
  } catch(e) {}
  
  return {
    stars: 0,
    forks: 0,
    open_issues_count: 0,
    default_branch: 'main',
    created_at: createdAt,
    updated_at: new Date().toISOString(),
  };
}

async function getCommitCount(localPath, since) {
  let cmd = `git rev-list --count HEAD`;
  if (since) {
    cmd = `git rev-list --count HEAD --since="${since}"`;
  }
  const result = runGitCmd(localPath, cmd);
  return result ? parseInt(result, 10) : 0;
}

async function getIssueStats(localPath) {
  return { open_count: 0, closed_count: 0, stale_count: 0, avg_close_time_days: 0 };
}

async function getPRStats(localPath) {
  return { open_count: 0, merged_count: 0, closed_count: 0 };
}

async function getContributorCount(localPath) {
  const result = runGitCmd(localPath, `git shortlog -sn --all`);
  if (!result) return 1; // Minimum baseline
  return result.split('\n').filter(Boolean).length;
}

async function getRecentIssues(localPath, limit = 10) {
  return [];
}

async function getRecentCommits(localPath, limit = 10) {
  // format: %H (sha) | %s (msg) | %an (author) | %cI (date iso)
  const result = runGitCmd(localPath, `git log -n ${limit} --format="%H|%s|%an|%cI"`);
  if (!result) return [];
  
  return result.split('\n').filter(Boolean).map(line => {
    // Note: split on the first 3 pipes only in case commit messages possess pipes.
    const parts = line.split('|');
    const sha = parts.shift();
    const date = parts.pop();
    const author = parts.pop();
    const message = parts.join('|'); // Re-join remaining message fragments
    return { sha, message, author, date };
  });
}

async function getRepoMetrics(localPath) {
  const [commitsCount, contributorsCount] = await Promise.all([
    getCommitCount(localPath),
    getContributorCount(localPath)
  ]);
  
  return {
    stars: 0,
    forks: 0,
    watchers: 0,
    contributorsCount,
    commitsCount,
    issues: { open: 0, closed: 0 },
    traffic: { views: 0, uniqueVisitors: 0, clones: 0 }
  };
}

module.exports = {
  getRepoMeta,
  getCommitCount,
  getIssueStats,
  getPRStats,
  getContributorCount,
  getRecentIssues,
  getRecentCommits,
  getRepoMetrics
};
