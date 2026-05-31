const { ObjectId } = require("mongodb");
const { getDb } = require("../config/db");

/**
 * 1. GET /api/projects/:id/health
 */
const getHealth = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const db = getDb();

    // Verify Ownership
    const project = await db.collection("projects").findOne({ 
      _id: new ObjectId(id), 
      user_id: new ObjectId(userId) 
    });
    if (!project) return res.status(404).json({ error: "Project not found" });

    // Get latest snapshot
    const latestSnapshot = await db.collection("project_snapshots")
      .find({ project_id: new ObjectId(id) })
      .sort({ snapshot_date: -1 })
      .limit(1)
      .next();

    if (!latestSnapshot) {
      return res.status(200).json({ message: "No data yet. Run a sync." });
    }

    res.status(200).json({
      snapshot: latestSnapshot,
      score: latestSnapshot.health_score.overall,
      label: latestSnapshot.health_score.label,
      breakdown: latestSnapshot.health_score.breakdown,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * 2. GET /api/projects/:id/snapshots
 */
const getSnapshots = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const db = getDb();

    // Verify Ownership
    const project = await db.collection("projects").findOne({ 
      _id: new ObjectId(id), 
      user_id: new ObjectId(userId) 
    });
    if (!project) return res.status(404).json({ error: "Project not found" });

    const snapshots = await db.collection("project_snapshots")
      .find({ project_id: new ObjectId(id) })
      .sort({ snapshot_date: 1 }) // Chronological for charts
      .project({
        snapshot_date: 1,
        "health_score.overall": 1,
        commit_count: 1,
        "issue_stats.open_count": 1,
        "pr_stats.open_count": 1,
      })
      .toArray();

    const formatted = snapshots.map((s) => ({
      date: s.snapshot_date,
      health_score: s.health_score?.overall || 0,
      commit_count: s.commit_count || 0,
      open_issues: s.issue_stats?.open_count || 0,
      open_prs: s.pr_stats?.open_count || 0,
    }));

    res.status(200).json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * 3. GET /api/projects/:id/recommendations
 */
const getRecommendations = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const db = getDb();

    // Verify Ownership
    const project = await db.collection("projects").findOne({ 
      _id: new ObjectId(id), 
      user_id: new ObjectId(userId) 
    });
    if (!project) return res.status(404).json({ error: "Project not found" });

    // Get latest recommendations
    const recommendations = await db.collection("recommendations")
      .find({ project_id: new ObjectId(id) })
      .sort({ created_at: -1 })
      .limit(5)
      .toArray();

    // Order by severity (high first) manually or via query
    const severityMap = { high: 1, medium: 2, low: 3 };
    recommendations.sort((a, b) => severityMap[a.severity] - severityMap[b.severity]);

    res.status(200).json(recommendations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * 4. GET /api/projects/:id/alerts
 */
const getAlerts = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const db = getDb();

    // Verify Ownership
    const project = await db.collection("projects").findOne({ 
      _id: new ObjectId(id), 
      user_id: new ObjectId(userId) 
    });
    if (!project) return res.status(404).json({ error: "Project not found" });

    const alerts = await db.collection("alerts")
      .find({ project_id: new ObjectId(id), is_read: false })
      .sort({ created_at: -1 })
      .toArray();

    res.status(200).json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * 5. PATCH /api/projects/:id/alerts/:alertId/read
 */
const markAlertRead = async (req, res) => {
  const { id, alertId } = req.params;
  const userId = req.user.id;

  try {
    const db = getDb();

    // Verify Project Ownership
    const project = await db.collection("projects").findOne({ 
      _id: new ObjectId(id), 
      user_id: new ObjectId(userId) 
    });
    if (!project) return res.status(404).json({ error: "Project not found" });

    const result = await db.collection("alerts").updateOne(
      { _id: new ObjectId(alertId), project_id: new ObjectId(id) },
      { $set: { is_read: true } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Alert not found." });
    }

    res.status(200).json({ message: "Alert marked as read." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getHealth,
  getSnapshots,
  getRecommendations,
  getAlerts,
  markAlertRead,
};
