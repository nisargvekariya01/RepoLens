/**
 * Performs lightweight statistical trend analysis over historical timeline data.
 * 
 * @param {Array} data - Array containing chronologically sorted objects (e.g., { date: "...", count: 120 })
 * @param {number} [windowSize=7] - Moving average trailing window limit
 * @param {Object} [options] - Optional configurations
 * @param {string} [options.valueKey="count"] - Data property reflecting the trend metric
 * @param {string} [options.dateKey="date"] - Data property reflecting the timestamp
 * @returns {Object} Analytical payload indicating growth, averages, direction, and distinct spikes
 */
function analyzeTrend(data, windowSize = 7, options = {}) {
  const valueKey = options.valueKey || "count";
  const dateKey = options.dateKey || "date";

  if (!data || !Array.isArray(data) || data.length === 0) {
    return {
      growthRate: 0,
      trendDirection: "stable",
      movingAverage: 0,
      peaks: []
    };
  }

  // Secure chronological sorting to ensure end/start metric comparisons align correctly
  const sortedData = [...data].sort((a, b) => new Date(a[dateKey]) - new Date(b[dateKey]));

  const startValue = sortedData[0][valueKey] || 0;
  const endValue = sortedData[sortedData.length - 1][valueKey] || 0;

  // 1. Calculate Growth Rate percentage
  let growthRate = 0;
  if (startValue > 0) {
    growthRate = ((endValue - startValue) / startValue) * 100;
  } else if (endValue > 0) {
    growthRate = 100; // Baseline spike from 0 implies positive growth
  }

  // 2. Derive General Trend Direction
  let trendDirection = "stable";
  if (growthRate > 5) { // Threshold > 5% positive change
    trendDirection = "up";
  } else if (growthRate < -5) { // Threshold > 5% negative change
    trendDirection = "down";
  }

  // 3. Compute Trailing Moving Average
  const recentData = sortedData.slice(-windowSize);
  const sumRecent = recentData.reduce((acc, curr) => acc + (curr[valueKey] || 0), 0);
  const movingAverage = recentData.length > 0 ? (sumRecent / recentData.length) : 0;

  // 4. Detect Significant Activity Spikes (Peaks)
  // Lightweight Heuristic: Evaluate bounds against overall average trajectory to avoid complex variance math
  const totalSum = sortedData.reduce((acc, curr) => acc + (curr[valueKey] || 0), 0);
  const overallAvg = totalSum / sortedData.length;
  // A peak is loosely defined as being > 2x the standard average while ensuring the threshold is inherently > 0
  const threshold = Math.max(overallAvg * 2, 2);

  const peaks = [];
  for (const point of sortedData) {
    const val = point[valueKey] || 0;
    if (val >= threshold) {
      peaks.push({
        [dateKey]: point[dateKey],
        [valueKey]: val
      });
    }
  }

  return {
    growthRate: Math.round(growthRate * 100) / 100, // Constrain to 2 decimal points
    trendDirection,
    movingAverage: Math.round(movingAverage * 100) / 100,
    peaks
  };
}

module.exports = {
  analyzeTrend
};
