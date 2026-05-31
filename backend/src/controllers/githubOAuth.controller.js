/**
 * githubOAuth.controller.js
 *
 * Thin request-handling layer for GitHub OAuth + repo picker endpoints.
 * All business logic lives in githubOAuth.service.js.
 *
 * Public routes (no auth middleware):
 *   GET /api/github/oauth/login      → initiates OAuth redirect
 *   GET /api/github/oauth/callback   → GitHub sends user here after consent
 *
 * Protected routes (auth middleware):
 *   GET  /api/github/repos           → fetch paginated repo list
 *   POST /api/github/import-repo     → import picked repo as project
 */

const oauthService = require("../services/githubOAuth.service");
const authService  = require("../services/githubAuth.service");
const { checkRepoLimit } = require("../utils/subscriptionLimits");

// ─── GET /api/github/oauth/login ─────────────────────────────────────────────
/**
 * Initiates GitHub OAuth flow.
 *
 * Expects query param: ?id_token=<Firebase ID Token>
 * The Firebase token identifies the RepoLens user across the redirect round-trip.
 * State is stored in Redis keyed to the MongoDB user ID.
 */
async function oauthLogin(req, res) {
  const { id_token } = req.query;

  if (!id_token) {
    return res.status(400).json({
      error: "Missing id_token query parameter. Send your Firebase ID token.",
    });
  }

  try {
    // 1. Verify Firebase token → get MongoDB user
    const user = await oauthService.verifyFirebaseAndGetMongoUser(id_token);

    // 2. Generate CSRF state → stored in Redis with userId
    const state = await oauthService.createOAuthState(user._id.toString());

    // 3. Build GitHub OAuth URL and redirect
    const oauthUrl = oauthService.buildGitHubOAuthUrl(state);

    res.redirect(302, oauthUrl);
  } catch (err) {
    console.error("[oauthLogin] error:", err.message);
    const frontendErrorUrl = oauthService.buildFrontendCallbackUrl("error", {
      error_msg: encodeURIComponent("Authentication failed. Please try again."),
    });
    res.redirect(302, frontendErrorUrl);
  }
}

// ─── GET /api/github/oauth/callback ─────────────────────────────────────────
/**
 * GitHub redirects the user here after they authorize (or deny).
 * Exchanges code for access token, encrypts, stores, then redirects to frontend.
 */
async function oauthCallback(req, res) {
  const { code, state, error: ghError } = req.query;

  // User denied authorization on GitHub
  if (ghError) {
    console.warn("[oauthCallback] User denied GitHub OAuth:", ghError);
    return res.redirect(
      302,
      oauthService.buildFrontendCallbackUrl("cancelled", {
        error_msg: encodeURIComponent("GitHub authorization was cancelled."),
      })
    );
  }

  if (!code || !state) {
    return res.redirect(
      302,
      oauthService.buildFrontendCallbackUrl("error", {
        error_msg: encodeURIComponent("Missing code or state from GitHub."),
      })
    );
  }

  try {
    // 1. Validate CSRF state → get mongoUserId
    const mongoUserId = await oauthService.consumeOAuthState(state);
    if (!mongoUserId) {
      return res.redirect(
        302,
        oauthService.buildFrontendCallbackUrl("error", {
          error_msg: encodeURIComponent("Invalid or expired OAuth state. Please try connecting again."),
        })
      );
    }

    // 2. Exchange code for access token
    const { accessToken, scope } = await oauthService.exchangeCodeForToken(code);
    const scopes = scope ? scope.split(",").map((s) => s.trim()).filter(Boolean) : [];

    // 3. Validate, encrypt, and save token to MongoDB
    await oauthService.saveOAuthToken(mongoUserId, accessToken, scopes);

    // 4. Redirect to frontend success page
    res.redirect(302, oauthService.buildFrontendCallbackUrl("success"));
  } catch (err) {
    console.error("[oauthCallback] error:", err.message);
    res.redirect(
      302,
      oauthService.buildFrontendCallbackUrl("error", {
        error_msg: encodeURIComponent("Failed to complete GitHub authorization. Please try again."),
      })
    );
  }
}

// ─── GET /api/github/repos ───────────────────────────────────────────────────
/**
 * Returns paginated list of user's GitHub repositories.
 * Requires: Authorization: Bearer <Firebase token>
 *
 * Query params:
 *   page        number  (default 1)
 *   per_page    number  (default 30, max 100)
 *   search      string  (optional, filtered server-side)
 *   visibility  string  'all' | 'public' | 'private' (default 'all')
 */
async function listRepos(req, res) {
  const userId = req.user.id.toString();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page) || 30));
  const search = req.query.search || "";
  const visibility = ["all", "public", "private"].includes(req.query.visibility)
    ? req.query.visibility
    : "all";

  try {
    // Get decrypted token
    const token = await authService.getDecryptedTokenForUser(userId);
    if (!token) {
      return res.status(403).json({
        error: "GitHub account not connected. Connect via OAuth to browse repositories.",
        requiresOAuth: true,
      });
    }

    const result = await oauthService.fetchUserRepos(token, page, perPage, search, visibility);
    res.status(200).json(result);
  } catch (err) {
    console.error("[listRepos] error:", err.message);
    const status = err.response?.status;
    if (status === 401) {
      return res.status(401).json({
        error: "GitHub access token is invalid or expired. Please reconnect your GitHub account.",
        requiresOAuth: true,
      });
    }
    if (status === 403) {
      return res.status(403).json({
        error: "GitHub rate limit exceeded or insufficient permissions.",
      });
    }
    res.status(500).json({ error: "Failed to fetch repositories from GitHub." });
  }
}

// ─── POST /api/github/import-repo ───────────────────────────────────────────
/**
 * Creates a RepoLens project from a repository selected in the picker.
 * Body: { repo } — a repository object from the picker (shape from fetchUserRepos)
 */
async function importRepo(req, res) {
  const userId = req.user.id.toString();
  const { repo } = req.body;

  if (!repo || !repo.full_name || !repo.owner || !repo.name) {
    return res.status(400).json({ error: "Invalid repository data. Please select a valid repository." });
  }

  try {
    await checkRepoLimit(userId, req.user.email);
    const project = await oauthService.importRepository(userId, repo);
    res.status(201).json({
      message: `Repository "${repo.full_name}" imported successfully.`,
      id: project.id,
      project: {
        id: project.id,
        name: project.name,
        github_url: project.github_url,
        repo_owner: project.repo_owner,
        repo_name: project.repo_name,
        visibility: project.visibility,
      },
    });
  } catch (err) {
    console.error("[importRepo] error:", err.message);
    if (err.statusCode === 409) {
      return res.status(409).json({
        error: err.message,
        existingProjectId: err.existingProjectId,
      });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: "Failed to import repository." });
  }
}

module.exports = {
  oauthLogin,
  oauthCallback,
  listRepos,
  importRepo,
};
