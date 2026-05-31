/**
 * Filters an array of data objects by a designated time range.
 * 
 * @param {Array} data - Array of objects to filter.
 * @param {string} range - Predefined range ("30d", "90d", "365d") or "custom".
 * @param {Object} options - Configuration and custom dates.
 * @param {string|Date} [options.startDate] - Start date (inclusive) if range is "custom".
 * @param {string|Date} [options.endDate] - End date (inclusive) if range is "custom". Defaults to current time.
 * @param {string} [options.dateKey="date"] - Property name containing the date value in data objects.
 * @returns {Array} - The filtered data.
 */
function filterByTimeRange(data, range, options = {}) {
  if (!data || !Array.isArray(data)) return [];

  const now = new Date();
  let startDate = null;
  let endDate = now;

  switch (range) {
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "365d":
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    case "custom":
      if (options.startDate) {
        startDate = new Date(options.startDate);
      }
      if (options.endDate) {
        endDate = new Date(options.endDate);
      }
      break;
    default:
      // Return all data if an invalid or empty range is provided
      return data;
  }

  const dateKey = options.dateKey || "date";
  const startMs = startDate ? startDate.getTime() : 0;
  const endMs = endDate.getTime();

  // Optimized loop returning true strictly within bounds
  return data.filter(item => {
    const rawDate = item[dateKey];
    if (!rawDate) return false;
    
    // Parse timestamp (safely handle Date objects or strings)
    const itemDateMs = rawDate instanceof Date ? rawDate.getTime() : new Date(rawDate).getTime();
    
    if (isNaN(itemDateMs)) return false;

    return itemDateMs >= startMs && itemDateMs <= endMs;
  });
}

module.exports = {
  filterByTimeRange
};
