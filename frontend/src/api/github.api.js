/**
 * github.api.js
 * Frontend API calls for GitHub authentication, OAuth, and repo picker features.
 * Base URL = http://localhost:5000 (no /api suffix), so all paths must include /api.
 * Tokens are NEVER returned by the backend — only profile metadata.
 */

import api from "./axios";
import { auth } from "../config/firebase";

// ─── PAT / Profile ────────────────────────────────────────────────────────────

/** POST /api/github/connect — Save a GitHub PAT */
export const connectGitHub = (token) =>
  api.post("/api/github/connect", { token }).then((r) => r.data);

/** GET /api/github/me — Get connected GitHub profile (no token) */
export const getGitHubProfile = () =>
  api.get("/api/github/me").then((r) => r.data);

/** DELETE /api/github/disconnect — Remove GitHub connection */
export const disconnectGitHub = () =>
  api.delete("/api/github/disconnect").then((r) => r.data);

/** POST /api/github/validate-token — Validate PAT without saving */
export const validateGitHubToken = (token) =>
  api.post("/api/github/validate-token", { token }).then((r) => r.data);

/** POST /api/github/check-repo — Check repo visibility */
export const checkRepoVisibility = (owner, repo) =>
  api.post("/api/github/check-repo", { owner, repo }).then((r) => r.data);

// ─── OAuth Flow ───────────────────────────────────────────────────────────────

/**
 * Initiate GitHub OAuth flow.
 * Gets a fresh Firebase ID token, then does a FULL browser redirect
 * to the backend /oauth/login endpoint (not a fetch — this is intentional,
 * GitHub needs a real browser redirect for the OAuth consent screen).
 */
export async function initiateGitHubOAuth() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated. Please log in first.");

  const idToken = await user.getIdToken(true);
  sessionStorage.setItem("firebase_id_token_for_oauth", idToken);

  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const loginUrl = `${baseUrl}/api/github/oauth/login?id_token=${encodeURIComponent(idToken)}`;
  window.location.href = loginUrl;
}

// ─── Repository Picker ────────────────────────────────────────────────────────

/**
 * Fetch paginated list of user's GitHub repos.
 * GET /api/github/repos
 */
export const fetchMyRepos = (page = 1, perPage = 30, search = "", visibility = "all") =>
  api
    .get("/api/github/repos", { params: { page, per_page: perPage, search, visibility } })
    .then((r) => r.data);

/**
 * Import a selected repository as a RepoLens project.
 * POST /api/github/import-repo
 */
export const importRepo = (repo) =>
  api.post("/api/github/import-repo", { repo }).then((r) => r.data);
