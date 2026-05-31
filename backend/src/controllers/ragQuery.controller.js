/**
 * ragQuery.controller.js
 *
 * Handles real-time Copilot-style RAG queries for a project's codebase.
 *
 * Endpoint: POST /api/projects/:id/ai/query
 * Body: { question: string, topK?: number }
 * Response: { answer, sources, chunksUsed, question, projectId }
 *
 * Response time: 2–10 seconds (single Qdrant search + single LLM call)
 */

const { ObjectId } = require("mongodb");
const { getDb } = require("../config/db");
const { queryWithRAG } = require("../services/ragQuery.service");
const { checkAndIncrementRagLimit } = require("../utils/subscriptionLimits");

/**
 * POST /api/projects/:id/ai/query
 *
 * Real-time Copilot-style query against the indexed codebase.
 * Requires the project to have been indexed via ANALYZE_REPO first.
 */
async function queryCodebase(req, res) {
  try {
    const db = getDb();
    const projectId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.user.id);

    const { question, topK } = req.body;

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return res.status(400).json({
        error: "Missing required field: question (non-empty string)"
      });
    }

    // Verify project belongs to user
    const project = await db.collection("projects").findOne({
      _id: projectId,
      user_id: userId,
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check that the project has been indexed (ai_report with status completed or indexed)
    const latestReport = await db
      .collection("ai_reports")
      .findOne(
        { project_id: projectId },
        { sort: { generated_at: -1, created_at: -1 } }
      );

    if (!latestReport) {
      return res.status(400).json({
        error: "Project has not been analyzed yet. Run AI analysis first to index the codebase.",
        hint: "POST /api/projects/:id/ai/analyze/queue"
      });
    }

    try {
      await checkAndIncrementRagLimit(userId);
    } catch (limitErr) {
      return res.status(limitErr.statusCode || 429).json({ error: limitErr.message });
    }

    // Run RAG query
    const result = await queryWithRAG(
      projectId.toString(),
      question.trim(),
      project.name || project.repo_name,
      topK ? Math.min(parseInt(topK, 10) || 5, 10) : 5
    );

    return res.status(200).json({
      ...result,
      projectId: projectId.toString(),
      projectName: project.name || project.repo_name,
    });
  } catch (error) {
    console.error("[RAG:Controller] Query error:", error);
    return res.status(500).json({ error: "Internal server error during RAG query" });
  }
}

module.exports = { queryCodebase };
