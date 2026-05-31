/**
 * Analyzes an array of code file contents to estimate overall file complexity using 
 * heuristic approximations rather than an expensive AST parser.
 *
 * @param {Array<{ file: string, content: string }>} filesData - An array of objects detailing file paths and their text content.
 * @returns {Object} An object housing the top 10 most complex files sorted descending.
 */
function analyzeComplexity(filesData) {
  // Fallback defaults
  if (!Array.isArray(filesData) || filesData.length === 0) {
    return { complexFiles: [] };
  }

  const results = [];

  for (const item of filesData) {
    if (!item.file || typeof item.content !== 'string') {
      continue;
    }

    const content = item.content;
    const size = content.length;

    // 1. Number of functions (Approximation via regex mapping standard declarations)
    // Looking for 'function', arrow functions ('=>'), and class structures
    const functionMatches = content.match(/\bfunction\b|\=\>|\bclass\b/g);
    const numFunctions = functionMatches ? functionMatches.length : 0;

    // 2. Control flow paths (Approximation mapping conditional clauses)
    const controlFlowMatches = content.match(/\b(if|else|for|while|switch|catch)\b/g);
    const controlFlowPaths = controlFlowMatches ? controlFlowMatches.length : 0;

    // 3. Nesting depth (Approximation evaluating max consecutive scope depth utilizing { and } )
    let maxNestingDepth = 0;
    let currentDepth = 0;
    
    for (let i = 0; i < content.length; i++) {
        if (content[i] === '{') {
            currentDepth++;
            if (currentDepth > maxNestingDepth) {
                maxNestingDepth = currentDepth;
            }
        } else if (content[i] === '}') {
            currentDepth--;
            if (currentDepth < 0) currentDepth = 0; // Safeguard syntax errors artificially dropping into negative index 
        }
    }

    // 4. Determine Cumulative Complexity 
    // We synthesize these metrics using weighted approximations:
    // • Size imposes a baseline drag (e.g. 1 point for every 500 characters)
    // • Functions add linear structural load
    // • Branches and max nesting recursively boost cognitive overload and cyclomatic barriers.
    let baseScore = size / 500;
    baseScore += (numFunctions * 2);
    baseScore += (controlFlowPaths * 1.5);
    baseScore += (maxNestingDepth * 3);

    results.push({
      file: item.file,
      complexityScore: Math.round(baseScore),
      size: size
    });
  }

  // Final Rule: Sort descending (most complex at the top)
  results.sort((a, b) => b.complexityScore - a.complexityScore);

  return {
    // Return top 10 files
    complexFiles: results.slice(0, 10)
  };
}

module.exports = {
  analyzeComplexity
};
