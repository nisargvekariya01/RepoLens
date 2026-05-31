import api from "./axios";

/**
 * Invokes the soft migrations REST endpoint if standard Firebase Login fails (due to legacy DB mappings).
 */
export const migrateLogin = async (email, password) => {
  const { data } = await api.post("/api/auth/migrate-login", { email, password });
  return data;
};

export const getMe = async () => {
  const { data } = await api.get("/api/auth/me");
  return data;
};
