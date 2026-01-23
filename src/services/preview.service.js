import { api } from '@/utils/api';

export default {
  /**
   * Generate preview for given PFS configurations
   */
  async generatePreview(workspaceId, pfs = null) {
    let url = `/workspaces/${workspaceId}/previews`;
    const query = new URLSearchParams();
    pfs.forEach((p) => query.append('pfs', p));
    return api.get(`${url}?${query}`);
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
