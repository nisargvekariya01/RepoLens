const path = require('path');

// Simple map for detecting common languages based on extensions
const EXTENSION_MAP = {
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.html': 'HTML',
  '.css': 'CSS',
  '.scss': 'CSS',
  '.py': 'Python',
  '.java': 'Java',
  '.go': 'Go',
  '.rs': 'Rust',
  '.cpp': 'C++',
  '.c': 'C',
  '.cs': 'C#',
  '.php': 'PHP',
  '.rb': 'Ruby',
  '.vue': 'Vue',
  '.sql': 'SQL',
  '.sh': 'Shell',
  '.bash': 'Shell',
  '.kt': 'Kotlin',
  '.swift': 'Swift',
  '.dart': 'Dart',
  '.scala': 'Scala',
  '.m': 'Objective-C',
  '.h': 'C/C++ Header',
  '.hpp': 'C++ Header'
};

/**
 * Super lightweight and fast static analyzer for a project's stack and dependencies.
 * 
 * @param {Array<string>} fileList - Array of file paths in the directory structure.
 * @param {Object} packageJson - Parsed package.json object.
 * @returns {Object} Language breakdown and dependency metrics.
 */
function analyzeTechStack(fileList, packageJson) {
  const result = {
    languages: [],
    dependencies: {
      total: 0,
      outdated: 0,
      risky: 0
    }
  };

  // 1. Language Breakdown processing
  const langCounts = {};
  let totalTrackedFiles = 0;

  if (Array.isArray(fileList)) {
    for (const file of fileList) {
      if (typeof file !== 'string') continue;

      const ext = path.extname(file).toLowerCase();
      const lang = EXTENSION_MAP[ext];
      
      if (lang) {
        langCounts[lang] = (langCounts[lang] || 0) + 1;
        totalTrackedFiles++;
      }
    }
  }

  // Calculate percentages
  for (const [name, count] of Object.entries(langCounts)) {
    result.languages.push({
      name,
      percentage: totalTrackedFiles > 0 ? Math.round((count / totalTrackedFiles) * 100) : 0
    });
  }

  // Sort descending by percentage
  result.languages.sort((a, b) => b.percentage - a.percentage);

  // 2. Dependencies Processing (Static Analysis)
  if (packageJson && typeof packageJson === 'object') {
    const deps = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {})
    };
    
    result.dependencies.total = Object.keys(deps).length;

    for (const version of Object.values(deps)) {
      if (typeof version !== 'string') continue;

      // Risky conditions: Wildcards (*), Unpinned latest versions, or direct URLs/git refs
      if (
        version.includes('*') || 
        version.includes('latest') || 
        version.includes('>') || 
        version.startsWith('git') || 
        version.startsWith('http') || 
        version.startsWith('file:')
      ) {
        result.dependencies.risky++;
      }

      // Outdated heuristic (Fast/Static approach without network calls):
      // If a package is pre-1.0 (^0.x, ~0.x) it is highly susceptible to breaking changes.
      // A robust implementation would asynchronously call `npm view <pkg> version` or `npm outdated`, 
      // but static avoids expensive IO.
      if (version.startsWith('^0.') || version.startsWith('~0.') || version === '0.0.0') {
        result.dependencies.outdated++;
      }
    }
  }

  return result;
}

module.exports = {
  analyzeTechStack
};
