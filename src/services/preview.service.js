import { api } from '@/utils/api';

export default {
  /**
   * Build the preview for the workspace's saved PFS list (owner only; publishes `preview.generated`)
   */
  async generatePreview(workspaceId) {
    return api.post(`/workspaces/${workspaceId}/previews`);
  },

  /**
   * The owner's last generated preview for the workspace's PFS list; 404 until one exists
   */
  async fetchCurrentPreview(workspaceId) {
    return api.getText(`/workspaces/${workspaceId}/previews/current`);
  },

  async downloadPreviewFile(workspaceId, pfs, documentType) {
    const query = new URLSearchParams();
    query.append('format', documentType);
    pfs.forEach((p) => query.append('pfs', p));
    return api.getBlob(`/workspaces/${workspaceId}/download?${query}`);
  },
};
