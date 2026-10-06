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
   * List the collaborators (invited by GitHub username, or joined through a share) of a workspace. Owner only.
   */
  async listCollaborators(workspaceId) {
    return api.get(`/workspaces/${workspaceId}/collaborators`);
  },

  /**
   * Grant one or more GitHub users access to a workspace. Owner only.
   */
  async addCollaborators(workspaceId, githubUsernames, mode) {
    return api.post(`/workspaces/${workspaceId}/collaborators`, {
      github_usernames: githubUsernames,
      mode,
    });
  },

  /**
   * Change a collaborator's access mode. Owner only.
   */
  async updateCollaborator(workspaceId, collaboratorId, mode) {
    return api.patch(`/workspaces/${workspaceId}/collaborators/${collaboratorId}`, { mode });
  },

  /**
   * Revoke a collaborator's access. Owner only.
   */
  async revokeCollaborator(workspaceId, collaboratorId) {
    return api.delete(`/workspaces/${workspaceId}/collaborators/${collaboratorId}`);
  },

  /**
   * List the shares (links) of a workspace. Owner only.
   */
  async listShares(workspaceId) {
    return api.get(`/workspaces/${workspaceId}/shares`);
  },

  /**
   * Create a mode-bound share (link) for the workspace. Owner only.
   */
  async createShare(workspaceId, mode, expiresAt = null) {
    return api.post(`/workspaces/${workspaceId}/shares`, { mode, expires_at: expiresAt });
  },

  /**
   * Permanently delete a share. Owner only.
   */
  async deleteShare(workspaceId, shareId) {
    return api.delete(`/workspaces/${workspaceId}/shares/${shareId}`);
  },

  /**
   * What a share leads to, for visitors who aren't logged in. Public, so it bypasses the `api`
   * helper (which needs a session). Throws with `status` 404 for an invalid or expired share.
   */
  async getSharePreview(token) {
    const response = await fetch(`${API_BASE_URL}/shares/${encodeURIComponent(token)}`);
    return parseOrThrow(response);
  },

  /**
   * Grant the logged-in user the share's access; resolves to `{ collaborator, workspace }`. The session
   * cookie authenticates the call, so this also bypasses the `api` helper and throws with
   * `status` 401 (not logged in), 403 (access revoked) or 404 (invalid/expired share).
   */
  async redeemShare(token) {
    const response = await fetch(`${API_BASE_URL}/shares/${encodeURIComponent(token)}/redeem`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', [CLIENT_ID_HEADER]: CLIENT_ID },
    });
    return parseOrThrow(response);
  },
};
