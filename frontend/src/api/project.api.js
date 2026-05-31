import api from "./axios";

export const getProjects = async () => {
  const { data } = await api.get("/api/projects");
  return data;
};

export const getProject = async (id) => {
  const { data } = await api.get(`/api/projects/${id}`);
  return data;
};

export const createProject = async (projectData) => {
  const { data } = await api.post("/api/projects", projectData);
  return data;
};

export const queueProjectSync = async (id) => {
  const { data } = await api.post(`/api/projects/${id}/sync/queue`);
  return data;
};

export const getProjectSyncJobs = async (id) => {
  const { data } = await api.get(`/api/projects/${id}/jobs`);
  return data;
};

export const renameProject = async (id, data) => {
  const res = await api.patch(`/api/projects/${id}`, data);
  return res.data;
};

export const deleteProject = async (id) => {
  const res = await api.delete(`/api/projects/${id}`);
  return res.data;
};

export const getRepoTree = async (id, format = "ascii") => {
  const res = await api.get(`/api/projects/${id}/tree?format=${format}`);
  return res.data;
};

export const getProjectMetrics = async (id) => {
  const res = await api.get(`/api/projects/${id}/metrics`);
  return res.data;
};

export const getProjectActivity = async (id, granularity = "day") => {
  const res = await api.get(`/api/projects/${id}/activity?granularity=${granularity}`);
  return res.data;
};

export const getProjectCodeQuality = async (id) => {
  const res = await api.get(`/api/projects/${id}/code-quality`);
  return res.data;
};

export const getProjectEventImpact = async (id, eventDate, range = "30d") => {
  const res = await api.get(`/api/projects/${id}/trends?range=${range}&eventDate=${eventDate}`);
  return res.data;
};

export const getProjectExport = async (id, format, data) => {
  const res = await api.post(`/api/projects/${id}/export`, { format, data }, {
    responseType: "blob" 
  });
  return res.data;
};

export const updateAutoRefresh = async (id, hours) => {
  const res = await api.post(`/api/projects/${id}/sync/auto-refresh`, { hours });
  return res.data;
};
