/**
 * githubOAuth.routes.js
 *
 * Routes for GitHub OAuth flow and repo picker.
 *
 * Public (no auth):
 *   GET /api/github/oauth/login      → initiates browser redirect to GitHub
 *   GET /api/github/oauth/callback   → GitHub sends code here
 *
 * Protected (Firebase JWT required):
 *   GET  /api/github/repos           → fetch paginated repo list
 *   POST /api/github/import-repo     → create project from picker selection
 */

const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const ctrl = require("../controllers/githubOAuth.controller");

// ── Public routes (no auth — these are browser redirects) ────────────────────

/**
 * GET /api/github/oauth/login?id_token=<Firebase ID Token>
 * Validates the Firebase token, generates CSRF state, redirects to GitHub.
 */
router.get("/oauth/login", ctrl.oauthLogin);

/**
 * GET /api/github/oauth/callback?code=X&state=Y
 * GitHub redirects browser here. Exchanges code → token → redirects to frontend.
 */
router.get("/oauth/callback", ctrl.oauthCallback);

// ── Protected routes ──────────────────────────────────────────────────────────

/**
 * GET /api/github/repos
 * Query: ?page=1&per_page=30&search=myapp&visibility=all
 */
router.get("/repos", authMiddleware, ctrl.listRepos);

/**
 * POST /api/github/import-repo
 * Body: { repo: { full_name, owner, name, ... } }
 */
router.post("/import-repo", authMiddleware, ctrl.importRepo);

module.exports = router;
