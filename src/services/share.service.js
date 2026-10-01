import { api } from '@/utils/api';
import { CLIENT_ID, CLIENT_ID_HEADER } from '@/utils/client-id';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function parseOrThrow(response) {
  const data = await response.json().catch(() => ({}));
  if (response.ok) {
    return data;
  }
  const err = new Error(
    data.detail || data.message || data.error || `Request failed with status ${response.status}`,
  );
  err.status = response.status;
  throw err;
}

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
   * Permanently delete a share link. Owner only.
   */
  async deleteShareLink(workspaceId, linkId) {
    return api.delete(`/workspaces/${workspaceId}/share-links/${linkId}`);
  },

  /**
   * What a link leads to, for visitors who aren't logged in. Public, so it bypasses the `api`
   * helper (which needs a session). Throws with `status` 404 for an invalid or expired link.
   */
  async getShareLinkPreview(token) {
    const response = await fetch(`${API_BASE_URL}/share-links/${encodeURIComponent(token)}`);
    return parseOrThrow(response);
  },

  /**
   * Grant the logged-in user the link's access; resolves to `{ share, workspace }`. The session
   * cookie authenticates the call, so this also bypasses the `api` helper and throws with
   * `status` 401 (not logged in), 403 (access revoked) or 404 (invalid/expired link).
   */
  async redeemShareLink(token) {
    const response = await fetch(
      `${API_BASE_URL}/share-links/${encodeURIComponent(token)}/redeem`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', [CLIENT_ID_HEADER]: CLIENT_ID },
      },
    );
    return parseOrThrow(response);
  },
};
