import { api } from '@/utils/api';
import { useAuthStore } from '@/stores/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default {
  /**
   * List all direct shares (invites by GitHub username) for a workspace. Owner only.
   */
  async listShares(workspaceId) {
    return api.get(`/workspaces/${workspaceId}/shares`);
  },

  /**
   * Grant one or more GitHub users access to a workspace. Owner only.
   */
  async createShares(workspaceId, githubUsernames, mode) {
    return api.post(`/workspaces/${workspaceId}/shares`, { githubUsernames, mode });
  },

  /**
   * Change a collaborator's access mode. Owner only.
   */
  async updateShare(workspaceId, shareId, mode) {
    return api.patch(`/workspaces/${workspaceId}/shares/${shareId}`, { mode });
  },

  /**
   * Revoke a collaborator's access. Owner only.
   */
  async revokeShare(workspaceId, shareId) {
    return api.delete(`/workspaces/${workspaceId}/shares/${shareId}`);
  },

  /**
   * List all share links for a workspace. Owner only.
   */
  async listShareLinks(workspaceId) {
    return api.get(`/workspaces/${workspaceId}/share-links`);
  },

  /**
   * Create a signed, mode-bound share link for the workspace. Owner only.
   */
  async createShareLink(workspaceId, mode, expiresAt = null) {
    return api.post(`/workspaces/${workspaceId}/share-links`, { mode, expiresAt });
  },

  /**
   * Update a share link's mode, active state, and/or expiry. Owner only.
   */
  async updateShareLink(workspaceId, linkId, updates) {
    return api.patch(`/workspaces/${workspaceId}/share-links/${linkId}`, updates);
  },

  /**
   * Permanently delete a share link. Owner only.
   */
  async deleteShareLink(workspaceId, linkId) {
    return api.delete(`/workspaces/${workspaceId}/share-links/${linkId}`);
  },

  /**
   * Redeem a share link. Works whether or not the caller is authenticated - unlike the rest of
   * this service, this does NOT go through the shared `api` helper (which requires an existing
   * session), since anonymous visitors must be able to see a preview before logging in.
   *
   * Returns either:
   * - { authenticated: true, share, workspace } on success (200)
   * - { authenticated: false, preview } when the caller isn't logged in yet (401)
   *
   * Throws for 403 (access revoked) and 404 (invalid/expired link).
   */
  async redeemShareLink(token) {
    const authStore = useAuthStore();
    const headers = { 'Content-Type': 'application/json' };
    if (authStore.isAuthenticated && !authStore.isTokenExpired) {
      headers.Authorization = authStore.authorizationHeader;
    }

    const response = await fetch(
      `${API_BASE_URL}/share-links/${encodeURIComponent(token)}/redeem`,
      {
        method: 'POST',
        headers,
      },
    );

    const data = await response.json().catch(() => ({}));

    if (response.status === 200) {
      return { authenticated: true, share: data.share, workspace: data.workspace };
    }

    if (response.status === 401) {
      return { authenticated: false, preview: data };
    }

    const message =
      data.detail || data.message || data.error || `Request failed with status ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    throw err;
  },
};
