const express = require("express");
const dashboardController = require("../controllers/dashboard.controller");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

// All routes are protected and prefixed with /api/projects/:id
router.get("/:id/health", authMiddleware, dashboardController.getHealth);
router.get("/:id/snapshots", authMiddleware, dashboardController.getSnapshots);
router.get("/:id/recommendations", authMiddleware, dashboardController.getRecommendations);
router.get("/:id/alerts", authMiddleware, dashboardController.getAlerts);
router.patch("/:id/alerts/:alertId/read", authMiddleware, dashboardController.markAlertRead);

module.exports = router;
