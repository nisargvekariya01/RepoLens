const fs = require('fs');
const path = require('path');

/**
 * Extract file-level metadata from a repository.
 * 
 * @param {string} rootPath - The root directory to scan.
 * @returns {Array<Object>} Array of file metadata objects.
 */
function scanFiles(rootPath) {
  const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);
  const MAX_FILE_SIZE = 500 * 1024; // 500KB limit
  const results = [];

  function walk(currentPath) {
    let items;
    try {
      items = fs.readdirSync(currentPath);
    } catch (err) {
      // Ignore directories we can't read
      return;
    }

    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      
      let stats;
      try {
        stats = fs.statSync(fullPath);
      } catch (err) {
        // Ignore files we can't stat
        continue;
      }

      if (stats.isDirectory()) {
        // Skip ignored directories
        if (!IGNORE_DIRS.has(item)) {
          walk(fullPath);
        }
      } else if (stats.isFile()) {
        // Skip large files (>500KB)
        if (stats.size > MAX_FILE_SIZE) {
          continue;
        }

        results.push({
          filePath: fullPath,
          size: stats.size,
          extension: path.extname(fullPath),
          lastModified: Math.floor(stats.mtimeMs) // Return timestamp
        });
      }
    }
  }

  if (fs.existsSync(rootPath)) {
    const rootStats = fs.statSync(rootPath);
    if (rootStats.isDirectory()) {
      walk(rootPath);
    } else if (rootStats.isFile() && rootStats.size <= MAX_FILE_SIZE) {
      // Edge case where rootPath is a single valid file
      results.push({
        filePath: rootPath,
        size: rootStats.size,
        extension: path.extname(rootPath),
        lastModified: Math.floor(rootStats.mtimeMs)
      });
    }
  }

  return results;
}

module.exports = {
  scanFiles
};
