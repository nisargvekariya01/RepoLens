const express = require("express");
const aiAnalysisController = require("../controllers/aiAnalysis.controller");
const { queryCodebase } = require("../controllers/ragQuery.controller");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

router.use(authMiddleware);

// POST /api/projects/:id/ai/analyze
router.post("/:id/ai/analyze", aiAnalysisController.runAnalysisAsJob);

// POST /api/projects/:id/ai/analyze/queue
// Auto-selects pipeline: Repomix (index-only) if local_path, else GitHub API
router.post("/:id/ai/analyze/queue", aiAnalysisController.runAnalysisAsJob);

// POST /api/projects/:id/ai/analyze/repomix  (explicit Repomix mode)
router.post("/:id/ai/analyze/repomix", aiAnalysisController.runAnalysisRepomixJob);

// POST /api/projects/:id/ai/query  ← Copilot-style real-time RAG query
// Body: { question: string, topK?: number (1-10) }
// Uses Qdrant top-k retrieval + single LLM call. Response in 2-10s.
router.post("/:id/ai/query", queryCodebase);

// GET /api/projects/:id/ai/report
router.get("/:id/ai/report", aiAnalysisController.getLatestReport);

// GET /api/projects/:id/ai/reports
router.get("/:id/ai/reports", aiAnalysisController.getReportHistory);

module.exports = router;

