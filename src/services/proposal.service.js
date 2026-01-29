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
    return api.put(`/workspaces/${workspaceId}/proposal`, payload);
  },
  async fetchProposal(workspaceId) {
    return api.get(`/workspaces/${workspaceId}/proposal`);
  },
  async commitChanges(workspaceId, commitMessage) {
    return api.put(`/workspaces/${workspaceId}/diffs`, {
      message: commitMessage,
    });
  },
};
