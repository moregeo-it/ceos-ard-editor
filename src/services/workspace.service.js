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
   * Sync workspace with remote changes from the user's fork
   */
  async syncWorkspace(workspaceId) {
    return api.post(`/workspaces/${workspaceId}/sync`);
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
   * Fetch the workspace types users can create workspaces for
   */
  async fetchTypes() {
    return api.get('/types');
  },

  /**
   * The repositories new workspaces of a type that chooses its repository can start from
   */
  async fetchRepositories(typeId) {
    return api.get(`/types/${encodeURIComponent(typeId)}/repositories`);
  },

  /**
   * The open pull requests of such a repository: `[{ number, title, author, head }]`
   */
  async fetchPullRequests(typeId, repository) {
    return api.get(
      `/types/${encodeURIComponent(typeId)}/repositories/${encodeURIComponent(repository)}/pull-requests`,
    );
  },

  /**
   * What a workspace can select for its preview, e.g. its PFS: `[{ id, title }]`
   */
  async fetchSelectionOptions(workspaceId) {
    const response = await api.get(`/workspaces/${workspaceId}/selection-options`);
    return response?.options || [];
  },

  /**
   * What new workspaces of a type select from its upstream repository, for a `selection` with `on_create`
   */
  async fetchTypeSelectionOptions(typeId) {
    const response = await api.get(`/types/${encodeURIComponent(typeId)}/selection-options`);
    return response?.options || [];
  },
};
