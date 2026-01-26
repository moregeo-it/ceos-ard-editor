import { api } from '@/utils/api';

export default {
  async loadDiffList(workspaceId) {
    const response = await api.get(`/workspaces/${workspaceId}/diffs`);
    return Array.isArray(response?.files) ? response.files : [];
  },
  async loadDiff(workspaceId, filePath) {
    return api.getText(`/workspaces/${workspaceId}/diffs/${encodeURIComponent(filePath)}`);
  },
  async createPullRequest(workspaceId, title, description) {
    return api.post(`/workspaces/${workspaceId}/propose`, {
      title,
      description,
    });
  },
};
