import { api } from '@/utils/api';

export default {
  /**
   * Build the preview for the workspace's saved selection (owner only; publishes `preview.generated`)
   */
  async generatePreview(workspaceId) {
    return api.post(`/workspaces/${workspaceId}/previews`);
  },

  /**
   * The owner's last generated preview for the workspace's selection; 404 until one exists
   */
  async fetchCurrentPreview(workspaceId) {
    return api.getText(`/workspaces/${workspaceId}/previews/current`);
  },

  /**
   * Render a single file, for workspace types that preview the open file
   */
  async renderFile(workspaceId, path) {
    return api.getText(`/workspaces/${workspaceId}/render/${encodeURIComponent(path)}`);
  },

  async downloadPreviewFile(workspaceId, selection, documentType) {
    const query = new URLSearchParams();
    query.append('format', documentType);
    selection.forEach((item) => query.append('selection', item));
    return api.getBlob(`/workspaces/${workspaceId}/download?${query}`);
  },
};
