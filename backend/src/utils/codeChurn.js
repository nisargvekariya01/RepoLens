const { execSync } = require('child_process');

/**
 * Implements code churn analysis by counting file changes in git history.
 * 
 * @param {string} repoPath - The absolute path to the git repository.
 * @returns {Object} An object containing the top 10 hotFiles with their churn scores.
 */
function analyzeCodeChurn(repoPath) {
  try {
    // Run git log to get a list of all changed files across all commits.
    // This outputs the files modified in each commit, each on a new line.
    const stdout = execSync('git log --pretty=format: --name-only', {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024 * 50 // 50MB buffer for large log histories
    });

    const lines = stdout.split('\n');
    const commitCounts = {};

    // Logic: Count number of commits per file
    for (const line of lines) {
      const file = line.trim();
      if (!file) continue; // Skip empty output lines

      if (!commitCounts[file]) {
        commitCounts[file] = 0;
      }
      commitCounts[file]++;
    }

    const files = Object.keys(commitCounts);
    if (files.length === 0) {
      return { hotFiles: [] };
    }

    // Find the max commits to serve as the baseline for normalization
    let maxCommits = 0;
    for (const file of files) {
      if (commitCounts[file] > maxCommits) {
        maxCommits = commitCounts[file];
      }
    }

    const fileStats = files.map(file => {
      const changes = commitCounts[file];
      
      // Logic: Normalize churnScore (0-100)
      // Higher commits = higher churn
      const churnScore = maxCommits > 0 
        ? Math.round((changes / maxCommits) * 100) 
        : 0;

      return {
        file,
        changes,
        churnScore
      };
    });

    // Rule: Sort descending (most unstable first)
    fileStats.sort((a, b) => {
      // Sort by churn score / changes descending
      return b.changes - a.changes;
    });

    // Rule: Limit top 10 files
    return {
      hotFiles: fileStats.slice(0, 10)
    };

  } catch (error) {
    throw new Error(`Failed to extract code churn logic from git: ${error.message}`);
  }
}

module.exports = {
  analyzeCodeChurn
};
