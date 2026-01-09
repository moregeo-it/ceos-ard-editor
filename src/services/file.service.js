import { api } from '@/utils/api'

export default {
  /**
   * Fetch file tree structure for a workspace
   */
  async fetchFileTree(workspaceId) {
    return api.get(`/workspaces/${workspaceId}/files`)
  },

  /**
   * Search files and folders
   */
  async searchFiles(workspaceId, query) {
    return api.get(`/workspaces/${workspaceId}/files/search?q=${encodeURIComponent(query)}`)
  },

  /**
   * Create new file or folder
   */
  async createFile(workspaceId, path, name, type) {
    return api.post(`/workspaces/${workspaceId}/files`, {
      path,
      name,
      type,
    })
  },

  /**
   * Rename file (files only, not folders)
   */
  async renameFile(workspaceId, filePath, newName) {
    return api.patch(`/workspaces/${workspaceId}/files/${encodeURIComponent(filePath)}`, {
      target: newName,
      operation: 'rename',
    })
  },

  /**
   * Delete file or folder
   */
  async deleteFile(workspaceId, filePath) {
    return api.delete(`/workspaces/${workspaceId}/files/${encodeURIComponent(filePath)}`)
  },

  /**
   * Save file content
   */
  async saveFile(workspaceId, filePath, content) {
    return api.put(`/workspaces/${workspaceId}/files/${encodeURIComponent(filePath)}`, {
      content,
    })
  },

  /**
   * Revert file to last saved state (files only, not folders)
   */
  async revertFile(workspaceId, filePath) {
    return api.patch(`/workspaces/${workspaceId}/files/${encodeURIComponent(filePath)}`, {
      operation: 'revert',
    })
  },
}
