import { api } from '@/utils/api';

export default {
  /**
   * Generate preview for given PFS configurations
   */
  async generatePreview(workspaceId, pfs = null) {
    let url = `/workspaces/${workspaceId}/previews`;
    if (pfs && pfs.length > 0) {
      // Build query string for multiple pfs
      const params = pfs.map((p) => `pfs=${encodeURIComponent(p)}`).join('&');
      url += `?${params}`;
    }
    return api.get(url);
  },

  async getPreviewStaticFile(workspaceId, filePath) {
    const url = `/workspaces/${workspaceId}/previews/${encodeURIComponent(filePath)}`;
    return api.get(url);
  },
};
