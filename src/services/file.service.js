import { api } from '@/utils/api'

export default {
  /**
   * Fetch file tree structure for a workspace
   */
  async fetchFileTree(workspaceId) {
    return api.get(`/workspaces/${workspaceId}/files`)
  },

  /**
   * Create new file or folder
   */
  async createFile(workspaceId, path, name, isDirectory = false) {
    return api.post(`/workspaces/${workspaceId}/files`, {
      path,
      name,
      directory: isDirectory,
    })
  },
}
