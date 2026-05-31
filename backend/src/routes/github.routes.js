/**
 * github.routes.js
 *
 * PAT-based GitHub authentication routes.
 * Auth middleware is applied per-route (not globally) so that the
 * public OAuth routes in githubOAuth.routes.js can share the /api/github prefix
 * without being blocked by authMiddleware.
 */

const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const ctrl = require("../controllers/githubAuth.controller");

/**
 * POST /api/github/connect
 * Save a GitHub Personal Access Token (PAT).
 * Body: { token: string }
 */
router.post("/connect", authMiddleware, ctrl.connectGitHub);

/**
 * GET /api/github/me
 * Return connected GitHub profile info (no token).
 */
router.get("/me", authMiddleware, ctrl.getGitHubMe);

/**
 * DELETE /api/github/disconnect
 * Remove GitHub token and clear connection.
 */
router.delete("/disconnect", authMiddleware, ctrl.disconnectGitHub);

/**
 * POST /api/github/validate-token
 * Validate a token without saving it.
 * Body: { token: string }
 */
router.post("/validate-token", authMiddleware, ctrl.validateToken);

/**
 * POST /api/github/check-repo
 * Check if a repo is private/public.
 * Body: { owner: string, repo: string }
 */
router.post("/check-repo", authMiddleware, ctrl.checkRepo);

module.exports = router;
