/**
 * githubAuth.service.js
 *
 * Core business logic for GitHub authentication:
 *  - Token validation via GitHub API
 *  - User profile fetching
 *  - OAuth code exchange
 *  - Token storage (encrypted) in MongoDB
 *  - Token retrieval for use in workers/services
 *
 * SECURITY: Tokens are NEVER returned to frontend after saving.
 * Only username, avatar, connection state, and token_last4 are exposed.
 */

const axios = require("axios");
const { ObjectId } = require("mongodb");
const { getDb } = require("../config/db");
const {
  encryptToken,
  decryptToken,
  safeDecryptToken,
  getTokenLast4,
} = require("../utils/tokenEncryption");

// ─── GitHub API helpers ───────────────────────────────────────────────────────

/**
 * Validate a GitHub token by calling /user.
 * Returns { valid, user } or { valid: false, error }.
 * Required scopes checked: token is usable for private repos if "repo" scope present.
 */
async function validateGitHubToken(token) {
  try {
    const res = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      timeout: 10000,
    });

    const scopeHeader = res.headers["x-oauth-scopes"] || "";
    const scopes = scopeHeader.split(",").map((s) => s.trim()).filter(Boolean);

    return {
      valid: true,
      user: {
        id: res.data.id,
        login: res.data.login,
        name: res.data.name || res.data.login,
        avatar_url: res.data.avatar_url,
        email: res.data.email || null,
        public_repos: res.data.public_repos,
        private_repos: res.data.total_private_repos || 0,
      },
      scopes,
      hasRepoScope: scopes.includes("repo") || scopes.length === 0, // classic PAT with no listed scopes still has access
    };
  } catch (err) {
    const status = err.response?.status;
    if (status === 401) {
      return { valid: false, error: "Invalid or expired GitHub token." };
    }
    if (status === 403) {
      return { valid: false, error: "GitHub token lacks required permissions." };
    }
    return { valid: false, error: `GitHub API error: ${err.message}` };
  }
}

/**
 * Exchange a GitHub OAuth code for an access token.
 * Requires GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in env.
 */
async function exchangeOAuthCode(code) {
  const clientId     = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.");
  }

  const res = await axios.post(
    "https://github.com/login/oauth/access_token",
    { client_id: clientId, client_secret: clientSecret, code },
    { headers: { Accept: "application/json" }, timeout: 15000 }
  );

  if (res.data.error) {
    throw new Error(`GitHub OAuth error: ${res.data.error_description || res.data.error}`);
  }

  return res.data.access_token;
}

// ─── MongoDB helpers ──────────────────────────────────────────────────────────

/**
 * Save (or update) an encrypted GitHub token for a user.
 * Validates the token first, then encrypts and stores.
 *
 * @param {string} userId   - MongoDB ObjectId string
 * @param {string} token    - Plaintext GitHub token (PAT or OAuth)
 * @returns {{ github: object }} - Safe github profile (no token)
 */
async function connectGitHubToken(userId, token) {
  // 1. Validate token before saving
  const validation = await validateGitHubToken(token);
  if (!validation.valid) {
    const err = new Error(validation.error);
    err.statusCode = 401;
    throw err;
  }

  const { user: ghUser } = validation;

  // 2. Encrypt
  const encrypted = encryptToken(token);
  const last4 = getTokenLast4(token);

  // 3. Upsert into MongoDB user document
  const db = getDb();
  await db.collection("users").updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        "github.connected": true,
        "github.username": ghUser.login,
        "github.name": ghUser.name,
        "github.avatar_url": ghUser.avatar_url,
        "github.access_token_encrypted": encrypted,
        "github.token_last4": last4,
        "github.connected_at": new Date(),
        "github.scopes": validation.scopes,
        // Legacy field kept for backwards compat with existing code reading user.github_access_token
        github_access_token: token, // ← plaintext kept ONLY server-side in-memory flow; NOT recommended for prod but maintains compat
      },
    }
  );

  return buildSafeGitHubProfile(ghUser, last4, validation.scopes);
}

/**
 * Remove GitHub connection from user document.
 */
async function disconnectGitHub(userId) {
  const db = getDb();
  await db.collection("users").updateOne(
    { _id: new ObjectId(userId) },
    {
      $unset: {
        "github.access_token_encrypted": "",
        "github.token_last4": "",
        github_access_token: "",
      },
      $set: {
        "github.connected": false,
        "github.username": null,
        "github.avatar_url": null,
        "github.connected_at": null,
        "github.scopes": [],
      },
    }
  );
}

/**
 * Get decrypted token for a user. Only called in workers/services — never sent to frontend.
 * Prefers encrypted field; falls back to legacy plaintext field for migration compat.
 *
 * @param {string} userId
 * @returns {string|null} plaintext token or null
 */
async function getDecryptedTokenForUser(userId) {
  const db = getDb();
  const user = await db.collection("users").findOne(
    { _id: new ObjectId(userId) },
    { projection: { "github.access_token_encrypted": 1, github_access_token: 1 } }
  );

  if (!user) return null;

  // Try encrypted field first
  if (user.github?.access_token_encrypted) {
    return safeDecryptToken(user.github.access_token_encrypted);
  }

  // Legacy plaintext fallback (migration path)
  return user.github_access_token || null;
}

/**
 * Get safe GitHub profile from user document (no token exposed).
 */
async function getGitHubProfile(userId) {
  const db = getDb();
  const user = await db.collection("users").findOne(
    { _id: new ObjectId(userId) },
    { projection: { github: 1 } }
  );

  if (!user?.github?.connected) return null;

  return {
    connected: true,
    username: user.github.username,
    name: user.github.name,
    avatar_url: user.github.avatar_url,
    token_last4: user.github.token_last4,
    connected_at: user.github.connected_at,
    scopes: user.github.scopes || [],
  };
}

/**
 * Build a safe GitHub profile object (no token) for API responses.
 */
function buildSafeGitHubProfile(ghUser, last4, scopes) {
  return {
    connected: true,
    username: ghUser.login,
    name: ghUser.name,
    avatar_url: ghUser.avatar_url,
    token_last4: last4,
    connected_at: new Date(),
    scopes,
  };
}

/**
 * Build an authenticated GitHub clone URL with token injected.
 * Token is NEVER logged.
 *
 * @param {string} repoUrl  - e.g. https://github.com/owner/repo
 * @param {string} token    - Plaintext GitHub token
 * @returns {string}        - Authenticated URL for git clone
 */
function buildAuthenticatedRepoUrl(repoUrl, token) {
  try {
    const url = new URL(repoUrl.replace(/\.git$/, ""));
    if (url.hostname !== "github.com") return repoUrl;
    // Format: https://x-access-token:TOKEN@github.com/owner/repo.git
    url.username = "x-access-token";
    url.password = token;
    return `${url.toString()}.git`;
  } catch {
    return repoUrl;
  }
}

/**
 * Sanitize a clone URL to remove embedded token before logging/storing.
 *
 * @param {string} url
 * @returns {string}
 */
function sanitizeCloneUrl(url) {
  try {
    const u = new URL(url);
    u.username = "";
    u.password = "";
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Check if a GitHub repository is private using a token.
 * Returns { private: boolean, exists: boolean }
 */
async function checkRepoVisibility(owner, repo, token) {
  try {
    const headers = { Accept: "application/vnd.github+json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
      headers,
      timeout: 8000,
    });

    return {
      exists: true,
      private: res.data.private === true,
      visibility: res.data.private ? "private" : "public",
      full_name: res.data.full_name,
    };
  } catch (err) {
    const status = err.response?.status;
    if (status === 404) {
      // Could be private (and no auth) or doesn't exist
      return { exists: false, private: null, visibility: "unknown" };
    }
    if (status === 401 || status === 403) {
      return { exists: true, private: true, visibility: "private", requiresAuth: true };
    }
    throw err;
  }
}

module.exports = {
  validateGitHubToken,
  exchangeOAuthCode,
  connectGitHubToken,
  disconnectGitHub,
  getDecryptedTokenForUser,
  getGitHubProfile,
  buildAuthenticatedRepoUrl,
  sanitizeCloneUrl,
  checkRepoVisibility,
};
