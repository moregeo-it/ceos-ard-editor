import { api } from '@/utils/api';

export default {
  /**
   * Fetch all workspaces for authenticated user
   */
  async fetchWorkspaces() {
    return api.get('/workspaces');
  },

  /**
   * Create new workspace
   */
  async createWorkspace(workspaceData) {
    return api.post('/workspaces', workspaceData);
  },

  /**
   * Get single workspace details
   */
  async getWorkspace(workspaceId) {
    return api.get(`/workspaces/${workspaceId}`);
  },

  /**
   * Update workspace
   */
  async updateWorkspace(workspaceId, workspaceData) {
    return api.patch(`/workspaces/${workspaceId}`, workspaceData);
  },

  /**
   * Toggle workspace status (active <-> archived)
   */
  async toggleWorkspaceStatus(workspaceId, newStatus) {
    return api.patch(`/workspaces/${workspaceId}`, { status: newStatus });
  },

  /**
   * Delete workspace (permanent)
   */
  async deleteWorkspace(workspaceId) {
    return api.delete(`/workspaces/${workspaceId}`);
  },

  /**
   * Fetch available PFS types (Product Format Specifications)
   */
  async fetchPfs(workspaceId) {
    const endpoint = workspaceId ? `/workspaces/${workspaceId}/pfs` : '/pfs';
    const response = await api.get(endpoint);
    return response?.pfsTypes || [];
  },
};
