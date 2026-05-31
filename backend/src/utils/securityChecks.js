const fs = require('fs');
const path = require('path');

/**
 * Perform basic security and best practice checks linearly across target files.
 * 
 * @param {Array<{ file: string, content: string }>} filesData - In-memory file contents.
 * @param {string} repoRoot - Fallback absolute path to the repository on disk.
 * @returns {Object} Security and metadata scoring results.
 */
function analyzeSecurity(filesData = [], repoRoot = '') {
  const result = {
    secretsFound: false,
    issues: [],
    hasLicense: false,
    hasReadme: false,
    readmeQualityScore: 0
  };

  let readmeContent = '';

  // 1. In-Memory Static Scan (Fast string manipulation)
  if (Array.isArray(filesData)) {
    for (const item of filesData) {
      if (!item.file || typeof item.content !== 'string') continue;

      const filename = path.basename(item.file).toLowerCase();

      // Look for standard root documents
      if (filename.startsWith('readme')) {
        result.hasReadme = true;
        readmeContent = item.content;
      }
      if (filename.startsWith('license')) {
        result.hasLicense = true;
      }

      // Hardcode/Secret Scanning
      // Look for explicit keys ending in _key, secret, or password mapped directly to a string.
      // Ignores dummy mapping dynamically without doing heavy lexing analysis.
      const secretRegex = /\b(api_key|apikey|secret|password)\b\s*[:=]\s*['"]([^'"]+)['"]/ig;
      let match;
      while ((match = secretRegex.exec(item.content)) !== null) {
        const potentialSecret = match[2];
        
        // Exclude dummy templates or empty values rapidly
        if (
          potentialSecret && 
          potentialSecret.toLowerCase() !== 'xxx' && 
          potentialSecret.toLowerCase() !== 'your_api_key' &&
          potentialSecret.length > 3
        ) {
          result.secretsFound = true;
          result.issues.push(`Hardcoded secret/key detected in file: ${item.file}`);
          break; // Optimization: bail early after confirming the file is compromised
        }
      }
    }
  }

  // 2. Disk Analysis Optimization (Only if files aren't pre-loaded) 
  // We check via typical FS ops if the root exist to grab missing general metadata.
  if (repoRoot && typeof repoRoot === 'string') {
    try {
      if (fs.existsSync(repoRoot)) {
        const files = fs.readdirSync(repoRoot);
        for (const file of files) {
          const lowerCaseFile = file.toLowerCase();
          
          if (!result.hasReadme && lowerCaseFile.startsWith('readme')) {
            result.hasReadme = true;
            readmeContent = fs.readFileSync(path.join(repoRoot, file), 'utf8');
          }
          if (!result.hasLicense && lowerCaseFile.startsWith('license')) {
            result.hasLicense = true;
          }
        }
      }
    } catch (err) {
      // Completely silently handle fs IO errors to avoid blowing up execution
    }
  }

  // 3. Documentation Readability Calculation
  if (result.hasReadme && readmeContent) {
    let score = 0;
    
    // Scale points based on length (Max 30)
    const len = readmeContent.length;
    if (len > 800) score += 30;
    else if (len > 300) score += 20;
    else if (len > 50) score += 10;
    
    // Scale points based on structured headers/keywords (Max 70 points)
    const lowerReadme = readmeContent.toLowerCase();
    
    // Typical healthy OSS sections
    const targetSections = [
      'install', 
      'usage', 
      'getting started',
      'configure', 
      'test', 
      'build', 
      'contribut', 
      'license', 
      'api'
    ];
    
    for (const section of targetSections) {
      if (lowerReadme.includes(section)) {
         score += 10; 
      }
    }

    // Clamp score safely to max of 100
    result.readmeQualityScore = score > 100 ? 100 : score;
  }

  return result;
}

module.exports = {
  analyzeSecurity
};
