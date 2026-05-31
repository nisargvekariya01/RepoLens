/**
 * githubOAuth.service.js
 *
 * GitHub OAuth-specific business logic:
 *  - OAuth URL generation with CSRF state (stored in Redis)
 *  - OAuth code exchange → token → profile → encrypted storage
 *  - Paginated repository fetching (/user/repos)
 *  - Import-from-picker (create project from GitHub repo metadata)
 *
 * SECURITY:
 *  - State tokens expire in 10 minutes (Redis TTL)
 *  - User identity survives redirect via Redis state lookup
 *  - Access tokens NEVER returned to frontend
 */

const crypto = require("crypto");
const axios = require("axios");
const { ObjectId } = require("mongodb");
const { getDb } = require("../config/db");
const redis = require("../config/redis");
const admin = require("../config/firebase-admin");
const {
  encryptToken,
  safeDecryptToken,
  getTokenLast4,
} = require("../utils/tokenEncryption");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const GITHUB_API = "https://api.github.com";

// ─── State / CSRF ─────────────────────────────────────────────────────────────

const STATE_TTL_SECONDS = 600; // 10 minutes

/**
 * Generate a cryptographically random state token, store userId → Redis.
 * @param {string} mongoUserId - MongoDB ObjectId string of the user
 * @returns {string} state token to include in GitHub OAuth URL
 */
async function createOAuthState(mongoUserId) {
  const state = crypto.randomBytes(32).toString("hex");
  if (!redis) throw new Error("Redis not available for OAuth state storage.");
  await redis.set(`oauth_state:${state}`, mongoUserId, "EX", STATE_TTL_SECONDS);
  return state;
}

/**
 * Validate state from GitHub callback. Deletes it (one-time use).
 * @param {string} state
 * @returns {string|null} mongoUserId or null if invalid/expired
 */
async function consumeOAuthState(state) {
  if (!state || !redis) return null;
  const userId = await redis.get(`oauth_state:${state}`);
  if (userId) await redis.del(`oauth_state:${state}`);
  return userId || null;
}

// ─── OAuth URL ────────────────────────────────────────────────────────────────

/**
 * Build the GitHub authorization URL.
 * Scopes: read:user (profile), repo (private repo access)
 */
function buildGitHubOAuthUrl(state) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) throw new Error("GITHUB_CLIENT_ID not set.");

  // Do NOT send redirect_uri — GitHub will use the URL registered in the OAuth App settings.
  // Sending a mismatched redirect_uri causes the "Be careful!" error on GitHub.
  const params = new URLSearchParams({
    client_id: clientId,
    scope: "read:user repo",
    state,
    allow_signup: "true",
    prompt: "consent",
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}


// ─── Token Exchange ───────────────────────────────────────────────────────────

/**
 * Exchange OAuth code for access token.
 */
async function exchangeCodeForToken(code) {
  const res = await axios.post(
    "https://github.com/login/oauth/access_token",
    {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    },
    { headers: { Accept: "application/json" }, timeout: 15000 }
  );

  if (res.data.error) {
    throw new Error(`GitHub OAuth error: ${res.data.error_description || res.data.error}`);
  }
  if (!res.data.access_token) {
    throw new Error("GitHub did not return an access token. The code may have expired.");
  }

  return {
    accessToken: res.data.access_token,
    tokenType: res.data.token_type,
    scope: res.data.scope || "",
  };
}

// ─── GitHub API Helpers ───────────────────────────────────────────────────────

function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/**
 * Fetch GitHub user profile using the token.
 */
async function fetchGitHubUser(token) {
  const res = await axios.get(`${GITHUB_API}/user`, {
    headers: ghHeaders(token),
    timeout: 10000,
  });
  return res.data;
}

// ─── Store Token in MongoDB ───────────────────────────────────────────────────

/**
 * Save an OAuth token for a user (encrypted).
 * Called after successful OAuth callback.
 *
 * @param {string} mongoUserId
 * @param {string} accessToken   Plaintext OAuth token
 * @param {string[]} scopes      Array of granted scopes
 */
async function saveOAuthToken(mongoUserId, accessToken, scopes) {
  const ghUser = await fetchGitHubUser(accessToken);
  const encrypted = encryptToken(accessToken);
  const last4 = getTokenLast4(accessToken);

  const db = getDb();
  await db.collection("users").updateOne(
    { _id: new ObjectId(mongoUserId) },
    {
      $set: {
        "github.connected": true,
        "github.auth_method": "oauth",
        "github.username": ghUser.login,
        "github.name": ghUser.name || ghUser.login,
        "github.avatar_url": ghUser.avatar_url,
        "github.github_id": ghUser.id,
        "github.access_token_encrypted": encrypted,
        "github.token_last4": last4,
        "github.connected_at": new Date(),
        "github.scopes": scopes,
        "github.public_repos": ghUser.public_repos,
        "github.private_repos": ghUser.total_private_repos || 0,
      },
    }
  );

  return {
    connected: true,
    auth_method: "oauth",
    username: ghUser.login,
    name: ghUser.name || ghUser.login,
    avatar_url: ghUser.avatar_url,
    token_last4: last4,
    connected_at: new Date(),
    scopes,
    public_repos: ghUser.public_repos,
    private_repos: ghUser.total_private_repos || 0,
  };
}

// ─── Repository Fetching ──────────────────────────────────────────────────────

/**
 * Fetch paginated repository list for authenticated user.
 * Includes personal + org + collaborator repos.
 *
 * @param {string} token       Plaintext access token
 * @param {number} page        1-indexed
 * @param {number} perPage     Max 100
 * @param {string} search      Optional search term (client-side filtered for now)
 * @param {string} visibility  'all' | 'public' | 'private'
 */
async function fetchUserRepos(token, page = 1, perPage = 30, search = "", visibility = "all") {
  const params = new URLSearchParams({
    visibility,
    affiliation: "owner,collaborator,organization_member",
    sort: "updated",
    direction: "desc",
    per_page: Math.min(perPage, 100).toString(),
    page: page.toString(),
  });

  const res = await axios.get(`${GITHUB_API}/user/repos?${params}`, {
    headers: ghHeaders(token),
    timeout: 15000,
  });

  // Link header tells us if there are more pages
  const linkHeader = res.headers["link"] || "";
  const hasNextPage = linkHeader.includes('rel="next"');

  let repos = res.data.map((r) => ({
    id: r.id,
    name: r.name,
    full_name: r.full_name,
    owner: r.owner.login,
    owner_avatar: r.owner.avatar_url,
    owner_type: r.owner.type, // "User" | "Organization"
    description: r.description || null,
    visibility: r.private ? "private" : "public",
    language: r.language || null,
    default_branch: r.default_branch,
    updated_at: r.updated_at,
    stargazers_count: r.stargazers_count,
    html_url: r.html_url,
    permissions: r.permissions || {},
    fork: r.fork,
  }));

  // Apply search filter (simple substring match on name/full_name)
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    repos = repos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.full_name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }

  return { repos, hasNextPage, page, perPage };
}

// ─── Import Repository ────────────────────────────────────────────────────────

/**
 * Create a RepoLens project from a GitHub repository selected in the picker.
 * @param {string} mongoUserId
 * @param {Object} repoData  - shape from fetchUserRepos
 */
async function importRepository(mongoUserId, repoData) {
  const { id: repoId, full_name, owner, name, default_branch, visibility, html_url } = repoData;

  if (!full_name || !owner || !name) {
    throw new Error("Invalid repository data provided.");
  }

  const db = getDb();

  // Check if this repo is already imported
  const existing = await db.collection("projects").findOne({
    user_id: new ObjectId(mongoUserId),
    "github_meta.repo_id": repoId,
  });

  if (existing) {
    const err = new Error(`Repository "${full_name}" is already imported.`);
    err.statusCode = 409;
    err.existingProjectId = existing._id.toString();
    throw err;
  }

  const newProject = {
    user_id: new ObjectId(mongoUserId),
    name,
    description: repoData.description || null,
    github_url: html_url,
    repo_owner: owner,
    repo_name: name,
    local_path: null,
    visibility,
    created_at: new Date(),
    updated_at: new Date(),
    // Rich GitHub metadata from picker (no token stored here)
    github_meta: {
      repo_id: repoId,
      full_name,
      owner,
      repo_name: name,
      default_branch: default_branch || "main",
      visibility,
      language: repoData.language || null,
      fork: repoData.fork || false,
      installation_type: "oauth",
      permissions: repoData.permissions || {},
    },
  };

  const result = await db.collection("projects").insertOne(newProject);

  return {
    id: result.insertedId.toString(),
    ...newProject,
    _id: result.insertedId,
  };
}

// ─── Verify Firebase ID Token (used in /oauth/login) ─────────────────────────

/**
 * Verify a Firebase ID token string and return the MongoDB user record.
 * Used to establish user identity before the OAuth redirect.
 */
async function verifyFirebaseAndGetMongoUser(firebaseIdToken) {
  const decoded = await admin.auth().verifyIdToken(firebaseIdToken);
  const db = getDb();
  const user = await db.collection("users").findOne({ firebase_uid: decoded.uid });
  if (!user) throw new Error("User not found in database.");
  return user;
}

// ─── Build Frontend Redirect URL ─────────────────────────────────────────────

function buildFrontendCallbackUrl(status, params = {}) {
  const url = new URL(`${FRONTEND_URL}/github/callback`);
  url.searchParams.set("status", status);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

module.exports = {
  createOAuthState,
  consumeOAuthState,
  buildGitHubOAuthUrl,
  exchangeCodeForToken,
  fetchGitHubUser,
  saveOAuthToken,
  fetchUserRepos,
  importRepository,
  verifyFirebaseAndGetMongoUser,
  buildFrontendCallbackUrl,
};
