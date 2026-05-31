/**
 * Analyze commit messages and patterns from an array of commits.
 * 
 * @param {Array<string|Object>} commits - Array of commit message strings or objects with a `message` property.
 * @returns {Object} Analysis results containing usage of conventional commits and a message quality score.
 */
function analyzeCommitPatterns(commits) {
  // Initialize default structure
  const result = {
    conventionalCommitsUsage: 0,
    commitTypes: {
      feat: 0,
      fix: 0,
      refactor: 0,
      chore: 0
    },
    messageQualityScore: 0
  };

  if (!Array.isArray(commits) || commits.length === 0) {
    return result;
  }

  let totalValidCommits = 0;
  let conventionalCount = 0;
  let totalQualityScore = 0;

  // Pattern to detect conventional commit prefixes: type(scope): or type:
  // We'll capture standard prefixes to maintain consistency checking
  const conventionalRegex = /^(feat|fix|refactor|chore|build|ci|docs|perf|style|test)(?:\(.*\))?!?:/;

  for (const item of commits) {
    // Gracefully handle raw strings or objects (e.g., from github API or local git log)
    const rawMessage = typeof item === 'object' && item !== null ? item.message || item.subject : String(item);
    
    if (typeof rawMessage !== 'string') continue;

    const msg = rawMessage.trim();
    if (msg.length === 0) continue; // Ignore empty messages

    totalValidCommits++;

    let commitScore = 0;

    // 1. Structure & Consistency Evaluation
    const match = msg.match(conventionalRegex);
    if (match) {
      conventionalCount++;
      commitScore += 50; // Structure bonus (50 pts) for strict conventional style
      
      const type = match[1];
      // Only increment types specifically requested in output schematic
      if (result.commitTypes[type] !== undefined) {
        result.commitTypes[type]++;
      }
    } else {
      // Partial structure: check if they at least used some custom prefix (e.g., Update:)
      if (/^\w+(?:\s+\w+)?:/.test(msg)) {
        commitScore += 20; 
      }
    }

    // 2. Message Length Evaluation
    // Good commit structure generally dictates a concise first line
    const firstLine = msg.split('\n')[0].trim();
    const len = firstLine.length;
    
    if (len >= 10 && len <= 72) {
      commitScore += 50; // Points for optimal headline length
    } else if (len > 0 && len <= 100) {
      commitScore += 30; // Acceptable length
    } else {
      commitScore += 10; // Overly long or overly brief
    }

    totalQualityScore += commitScore;
  }

  if (totalValidCommits > 0) {
    result.conventionalCommitsUsage = Math.round((conventionalCount / totalValidCommits) * 100);
    result.messageQualityScore = Math.round(totalQualityScore / totalValidCommits);
  }

  return result;
}

module.exports = {
  analyzeCommitPatterns
};
