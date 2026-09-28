import { api } from '@/utils/api';

export default {
  /**
   * Generate the preview for the given PFS list (owner only; publishes `preview.generated`)
   */
  async generatePreview(workspaceId, pfs = null) {
    let url = `/workspaces/${workspaceId}/previews`;
    const query = new URLSearchParams();
    pfs.forEach((p) => query.append('pfs', p));
    return api.get(`${url}?${query}`);
  },

  /**
   * The owner's last generated preview for the workspace's PFS list; 404 until one exists
   */
  async fetchCurrentPreview(workspaceId) {
    return api.getText(`/workspaces/${workspaceId}/previews/current`);
  },

  async getPreviewStaticFile(workspaceId, filePath) {
    const url = `/workspaces/${workspaceId}/previews/${encodeURIComponent(filePath)}`;
    return api.get(url);
  },

  async downloadPreviewFile(workspaceId, pfs, documentType) {
    const query = new URLSearchParams();
    query.append('format', documentType);
    pfs.forEach((p) => query.append('pfs', p));
    return api.getBlob(`/workspaces/${workspaceId}/download?${query}`);
  },
};
