import { api } from '@/utils/api'

export default {
  /**
   * Fetch all workspaces for authenticated user
   */
  async fetchWorkspaces() {
    return api.get('/workspaces')
  },

  /**
   * Create new workspace
   */
  async createWorkspace(workspaceData) {
    return api.post('/workspaces', workspaceData)
  },

  /**
   * Get single workspace details
   */
  async getWorkspace(workspaceId) {
    return api.get(`/workspaces/${workspaceId}`)
  },

  /**
   * Archive workspace (soft delete)
   */
  async archiveWorkspace(workspaceId) {
    return api.delete(`/workspaces/${workspaceId}`)
  },

  /**
   * Fetch available PFS (Product Format Specifications)
   */
  async fetchPfs() {
    const response = await api.get('/pfs')
    return response.pfsTypes || []
  },
}
