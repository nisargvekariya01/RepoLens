import api from "./axios";

export const getHealth = async (projectId) => {
  const { data } = await api.get(`/api/projects/${projectId}/health`);
  return data;
};

export const getSnapshots = async (projectId) => {
  const { data } = await api.get(`/api/projects/${projectId}/snapshots`);
  return data;
};

export const getRecommendations = async (projectId) => {
  const { data } = await api.get(`/api/projects/${projectId}/recommendations`);
  return data;
};

export const getAlerts = async (projectId) => {
  const { data } = await api.get(`/api/projects/${projectId}/alerts`);
  return data;
};

export const markAlertRead = async (projectId, alertId) => {
  const { data } = await api.patch(`/api/projects/${projectId}/alerts/${alertId}/read`);
  return data;
};

// --- AI Analysis ---

export const runAIAnalysis = async (projectId, force = false) => {
  const { data } = await api.post(`/api/projects/${projectId}/ai/analyze/queue`, { force });
  return data;
};

export const runAIAnalysisRepomix = async (projectId, force = false) => {
  const { data } = await api.post(`/api/projects/${projectId}/ai/analyze/repomix`, { force });
  return data;
};

/**
 * GET /api/projects/:id/ai/report
 * Always returns an envelope: { status, ready, data?, error?, progress?, message? }
 * Never throws for non-404 backend errors — returns null on network failure.
 */
export const getAIReport = async (projectId) => {
  try {
    const { data } = await api.get(`/api/projects/${projectId}/ai/report`);
    return data;
  } catch (err) {
    // Only re-throw genuine auth/server errors, not expected "not ready" states
    if (err.response?.status === 401 || err.response?.status === 403) throw err;
    return null;
  }
};

