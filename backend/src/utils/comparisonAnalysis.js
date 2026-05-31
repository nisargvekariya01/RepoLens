/**
 * Utility to calculate the mathematical average of a given dataset array.
 */
function calculateAverage(dataArray, valueKey = "count") {
  if (!dataArray || dataArray.length === 0) return 0;
  const sum = dataArray.reduce((acc, curr) => acc + (curr[valueKey] || 0), 0);
  return sum / dataArray.length;
}

/**
 * Utility to reliably map percentage change and protect against Division By Zero instances.
 */
function calculatePercentageChange(beforeVal, afterVal) {
  if (beforeVal > 0) {
    return ((afterVal - beforeVal) / beforeVal) * 100;
  } else if (afterVal > 0) {
    return 100;
  }
  return 0;
}

/**
 * Executes a statistical before-and-after comparison around a defining event.
 * 
 * @param {Object} historicalData - Container for structural metrics: { commits: [], stars: [] }
 * @param {string|Date} eventDate - The central date indicating the start of the 'after' period.
 * @param {Object} [options] - Dynamic property key configurations.
 * @returns {Object} Analytical payload featuring calculated averages and net percent impacts.
 */
function analyzeEventImpact(historicalData, eventDate, options = {}) {
  const dateKey = options.dateKey || "date";
  const valueKey = options.valueKey || "count";

  const eventMs = new Date(eventDate).getTime();

  // O(N) Array Splitter sorting timeline metrics into strictly before/after bounds
  const splitArray = (arr) => {
    if (!arr || !Array.isArray(arr)) return { before: [], after: [] };
    const before = [];
    const after = [];
    
    for (const item of arr) {
      const itemMs = new Date(item[dateKey]).getTime();
      if (isNaN(itemMs)) continue;

      if (itemMs < eventMs) {
        before.push(item);
      } else {
        after.push(item);
      }
    }
    
    return { before, after };
  };

  // Safely extract input
  const commitsData = historicalData.commits || [];
  const starsData = historicalData.stars || [];

  // Partition arrays across the target threshold timestamp
  const splitCommits = splitArray(commitsData);
  const splitStars = splitArray(starsData);

  // Compute sub-metric averages securely mapping zero if arrays fall empty
  const beforeAvgCommits = calculateAverage(splitCommits.before, valueKey);
  const afterAvgCommits = calculateAverage(splitCommits.after, valueKey);

  const beforeAvgStars = calculateAverage(splitStars.before, valueKey);
  const afterAvgStars = calculateAverage(splitStars.after, valueKey);

  // Synthesize formatted analytical response object
  return {
    before: {
      avgCommits: Math.round(beforeAvgCommits * 100) / 100,
      avgStarsGrowth: Math.round(beforeAvgStars * 100) / 100
    },
    after: {
      avgCommits: Math.round(afterAvgCommits * 100) / 100,
      avgStarsGrowth: Math.round(afterAvgStars * 100) / 100
    },
    impact: {
      commitsChange: Math.round(calculatePercentageChange(beforeAvgCommits, afterAvgCommits) * 100) / 100,
      starsChange: Math.round(calculatePercentageChange(beforeAvgStars, afterAvgStars) * 100) / 100
    }
  };
}

module.exports = {
  analyzeEventImpact
};
