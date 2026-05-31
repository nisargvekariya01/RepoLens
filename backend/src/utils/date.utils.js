/**
 * Returns ISO date for X days ago.
 * Default: 30 days.
 */
function getDaysAgo(days = 30) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

module.exports = {
  getDaysAgo,
};
