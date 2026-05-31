/**
 * useGitHubConnection.js
 * Custom hook for managing GitHub connection state throughout the app.
 * Returns connection status, profile, and mutation actions.
 */

import { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../config/firebase";
import {
  getGitHubProfile,
  connectGitHub,
  disconnectGitHub,
  validateGitHubToken,
} from "../api/github.api";

export function useGitHubConnection() {
  const [profile, setProfile] = useState(null);       // GitHub profile (no token)
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // ── Fetch current state ───────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const data = await getGitHubProfile();
      setProfile(data?.connected ? data : null);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { 
    if (user !== undefined) fetchProfile(); 
  }, [fetchProfile, user]);

  // ── Connect via PAT ───────────────────────────────────────────────────────
  const connect = useCallback(async (token) => {
    setConnecting(true);
    setError(null);
    try {
      const data = await connectGitHub(token);
      setProfile(data.github);
      return { success: true, profile: data.github };
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to connect GitHub.";
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setConnecting(false);
    }
  }, []);

  // ── Disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      await disconnectGitHub();
      setProfile(null);
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to disconnect.";
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setConnecting(false);
    }
  }, []);

  // ── Validate token (without saving) ─────────────────────────────────────
  const validate = useCallback(async (token) => {
    try {
      return await validateGitHubToken(token);
    } catch (err) {
      return { valid: false, error: err.response?.data?.error || "Validation failed." };
    }
  }, []);

  return {
    profile,
    isConnected: !!profile?.connected,
    loading,
    connecting,
    error,
    connect,
    disconnect,
    validate,
    refresh: fetchProfile,
  };
}
