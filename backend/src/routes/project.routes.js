const express = require("express");
const projectController = require("../controllers/project.controller");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

/**
 * All routes in this file are protected with authMiddleware
 */
router.use(authMiddleware);

/**
 * @route POST /api/projects
 * @desc Create a new project
 */
router.post("/", projectController.createProject);

/**
 * @route GET /api/projects
 * @desc List all projects for authenticated user
 */
router.get("/", projectController.listProjects);

/**
 * @route GET /api/projects/:id
 * @desc Get single project details
 */
router.get("/:id", projectController.getProject);

/**
 * @route PUT /api/projects/:id
 * @desc Update project details
 */
router.put("/:id", projectController.updateProject);
router.patch("/:id", projectController.updateProject);

/**
 * @route DELETE /api/projects/:id
 * @desc Delete project and cascading data
 */
router.delete("/:id", projectController.deleteProject);

/**
 * @route GET /api/projects/:id/tree
 * @desc Generate ASCII Tree representation of remote repository 
 */
router.get("/:id/tree", projectController.getProjectTree);

/**
 * @route GET /api/projects/:id/metrics
 * @desc Generate unified metrics calculation mapping live API traffic and historical DB trendlines. 
 */
router.get("/:id/metrics", projectController.getProjectMetrics);

/**
 * @route GET /api/projects/:id/activity
 * @desc Full activity analytics: commits, contributors, PRs, issues, DORA
 * @query granularity=day|week|month  (default: day)
 */
router.get("/:id/activity", projectController.getProjectActivity);

/**
 * @route GET /api/projects/:id/trends
 * @desc Get statistical tracking across specified bounded timeframes mapping commits & star traction.
 */
router.get("/:id/trends", projectController.getProjectTrends);

/**
 * @route GET /api/projects/:id/code-quality
 * @desc Get deep technical scanning aggregates utilizing git/fs sub-processes mapped onto the codebase history.
 */
router.get("/:id/code-quality", projectController.getProjectCodeQuality);

/**
 * @route POST /api/projects/:id/export
 * @desc Generate and download a JSON, CSV, or PDF report payload directly. 
 */
router.post("/:id/export", projectController.exportProjectData);

module.exports = router;
