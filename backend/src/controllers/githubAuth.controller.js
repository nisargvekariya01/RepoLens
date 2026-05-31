/**
 * githubAuth.controller.js
 *
 * Thin request-handling layer for GitHub authentication endpoints.
 * All business logic lives in githubAuth.service.js.
 *
 * Routes handled:
 *   POST   /api/github/connect          - Save PAT or OAuth token
 *   GET    /api/github/me               - Get connected profile
 *   DELETE /api/github/disconnect       - Remove token
 *   POST   /api/github/validate-token   - Validate a token without saving
 *   POST   /api/github/oauth/callback   - Exchange OAuth code for token
 *   POST   /api/github/check-repo       - Check repo visibility
 */

const githubAuthService = require("../services/githubAuth.service");

// ─── Connect GitHub (PAT) ────────────────────────────────────────────────────

/**
 * POST /api/github/connect
 * Body: { token: string }
 * Validates and saves an encrypted GitHub PAT for the authenticated user.
 */
async function connectGitHub(req, res) {
  const { token } = req.body;
  const userId = req.user.id;

  if (!token || typeof token !== "string" || token.trim().length < 10) {
    return res.status(400).json({
      error: "A valid GitHub Personal Access Token is required.",
      hint: "Generate one at: https://github.com/settings/tokens with 'repo' scope.",
    });
  }

  try {
    const profile = await githubAuthService.connectGitHubToken(userId, token.trim());
    res.status(200).json({
      message: "GitHub connected successfully.",
      github: profile,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    console.error("[connectGitHub] error:", err.message);
    res.status(status).json({
      error: err.message || "Failed to connect GitHub account.",
    });
  }
}

// ─── Get GitHub Profile ───────────────────────────────────────────────────────

/**
 * GET /api/github/me
 * Returns connected GitHub profile (no token exposed).
 */
async function getGitHubMe(req, res) {
  try {
    const profile = await githubAuthService.getGitHubProfile(req.user.id);
    if (!profile) {
      return res.status(200).json({ connected: false });
    }
    res.status(200).json(profile);
  } catch (err) {
    console.error("[getGitHubMe] error:", err.message);
    res.status(500).json({ error: "Failed to fetch GitHub profile." });
  }
}

// ─── Disconnect GitHub ────────────────────────────────────────────────────────

/**
 * DELETE /api/github/disconnect
 * Removes the encrypted token and clears GitHub connection.
 */
async function disconnectGitHub(req, res) {
  try {
    await githubAuthService.disconnectGitHub(req.user.id);
    res.status(200).json({ message: "GitHub account disconnected successfully." });
  } catch (err) {
    console.error("[disconnectGitHub] error:", err.message);
    res.status(500).json({ error: "Failed to disconnect GitHub account." });
  }
}

// ─── Validate Token (without saving) ─────────────────────────────────────────

/**
 * POST /api/github/validate-token
 * Body: { token: string }
 * Returns validation result and GitHub user info — does NOT save token.
 */
async function validateToken(req, res) {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "Token is required." });

  try {
    const result = await githubAuthService.validateGitHubToken(token.trim());
    if (!result.valid) {
      return res.status(401).json({ valid: false, error: result.error });
    }
    res.status(200).json({
      valid: true,
      username: result.user.login,
      name: result.user.name,
      avatar_url: result.user.avatar_url,
      scopes: result.scopes,
      hasRepoScope: result.hasRepoScope,
    });
  } catch (err) {
    console.error("[validateToken] error:", err.message);
    res.status(500).json({ error: "Token validation failed." });
  }
}

// ─── OAuth Code Exchange ──────────────────────────────────────────────────────

/**
 * POST /api/github/oauth/callback
 * Body: { code: string }
 * Exchanges GitHub OAuth code for access token, validates, and saves it.
 */
async function oauthCallback(req, res) {
  const { code } = req.body;
  const userId = req.user.id;

  if (!code) {
    return res.status(400).json({ error: "OAuth code is required." });
  }

  try {
    const token = await githubAuthService.exchangeOAuthCode(code);
    const profile = await githubAuthService.connectGitHubToken(userId, token);
    res.status(200).json({
      message: "GitHub connected via OAuth successfully.",
      github: profile,
    });
  } catch (err) {
    console.error("[oauthCallback] error:", err.message);
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || "OAuth connection failed." });
  }
}

// ─── Check Repo Visibility ────────────────────────────────────────────────────

/**
 * POST /api/github/check-repo
 * Body: { owner: string, repo: string }
 * Returns { private, exists, visibility } for a repository.
 * Uses the authenticated user's token if connected.
 */
async function checkRepo(req, res) {
  const { owner, repo } = req.body;
  const userId = req.user.id;

  if (!owner || !repo) {
    return res.status(400).json({ error: "owner and repo are required." });
  }

  try {
    const token = await githubAuthService.getDecryptedTokenForUser(userId);
    const result = await githubAuthService.checkRepoVisibility(owner, repo, token);
    res.status(200).json(result);
  } catch (err) {
    console.error("[checkRepo] error:", err.message);
    res.status(500).json({ error: "Failed to check repository visibility." });
  }
}

module.exports = {
  connectGitHub,
  getGitHubMe,
  disconnectGitHub,
  validateToken,
  oauthCallback,
  checkRepo,
};
