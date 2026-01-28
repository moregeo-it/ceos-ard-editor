import { api } from '@/utils/api';

export default {
  async loadDiffList(workspaceId) {
    const response = await api.get(`/workspaces/${workspaceId}/diffs`);
    return Array.isArray(response?.files) ? response.files : [];
  },
  async loadDiff(workspaceId, filePath) {
    return api.getText(`/workspaces/${workspaceId}/diffs/${encodeURIComponent(filePath)}`);
  },
  async createPullRequest(workspaceId, payload) {
    return api.post(`/workspaces/${workspaceId}/propose`, payload);
  },
  async fetchProposal(workspaceId) {
    return api.get(`/workspaces/${workspaceId}/proposal`);
  },
};
