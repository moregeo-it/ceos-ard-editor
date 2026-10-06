import { defineStore } from 'pinia';
import shareService from '@/services/share.service';

const PENDING_SHARE_TOKEN_KEY = 'ceos_ard_editor_pending_share_token';

const getDefaults = () => ({
  collaborators: [],
  shares: [],
  isLoadingCollaborators: false,
  isLoadingShares: false,
  isMutating: false,
  activeWorkspaceId: null,
});

/** Replace the entry with `id` in place; false when the list has none. */
function replaceById(list, id, item) {
  const index = list.findIndex((entry) => entry.id === id);
  if (index !== -1) {
    list[index] = item;
  }
  return index !== -1;
}

// Requests in flight; `isMutating` clears only when the last one settles
let pendingMutations = 0;

export const useShareStore = defineStore('share', {
  state: () => getDefaults(),

  actions: {
    async fetchCollaborators(workspaceId) {
      this.isLoadingCollaborators = true;
      try {
        const response = await shareService.listCollaborators(workspaceId);
        // Ignore responses for a workspace the dialog has since moved away from.
        if (workspaceId !== this.activeWorkspaceId) return;
        this.collaborators = response || [];
      } finally {
        if (workspaceId === this.activeWorkspaceId) this.isLoadingCollaborators = false;
      }
    },

    async fetchShares(workspaceId) {
      this.isLoadingShares = true;
      try {
        const response = await shareService.listShares(workspaceId);
        // Ignore responses for a workspace the dialog has since moved away from.
        if (workspaceId !== this.activeWorkspaceId) return;
        this.shares = response || [];
      } finally {
        if (workspaceId === this.activeWorkspaceId) this.isLoadingShares = false;
      }
    },

    /**
     * Send a change with `isMutating` set (the dialog disables its controls meanwhile) and apply
     * the response to the lists, unless the dialog has since moved to another workspace.
     */
    async _mutate(workspaceId, request, apply) {
      pendingMutations++;
      this.isMutating = true;
      try {
        const response = await request();
        if (workspaceId === this.activeWorkspaceId) {
          apply(response);
        }
        return response;
      } finally {
        pendingMutations--;
        this.isMutating = pendingMutations > 0;
      }
    },

    addCollaborators(workspaceId, githubUsernames, mode) {
      return this._mutate(
        workspaceId,
        () => shareService.addCollaborators(workspaceId, githubUsernames, mode),
        (added) => {
          // Merge: replace any existing collaborator with the same id, prepend the rest
          for (const collaborator of added || []) {
            if (!replaceById(this.collaborators, collaborator.id, collaborator)) {
              this.collaborators.unshift(collaborator);
            }
          }
        },
      );
    },

    updateCollaborator(workspaceId, collaboratorId, mode) {
      return this._mutate(
        workspaceId,
        () => shareService.updateCollaborator(workspaceId, collaboratorId, mode),
        (updated) => replaceById(this.collaborators, collaboratorId, updated),
      );
    },

    revokeCollaborator(workspaceId, collaboratorId) {
      return this._mutate(
        workspaceId,
        () => shareService.revokeCollaborator(workspaceId, collaboratorId),
        () => {
          // Revoke returns 204 (no body). A revoked invitee isn't dropped from the list - it stays,
          // shown greyed-out as "revoked" (that's what a reload returns and what the dialog renders),
          // so flip the row's status in place instead of removing it.
          const collaborator = this.collaborators.find((c) => c.id === collaboratorId);
          if (collaborator) {
            replaceById(this.collaborators, collaboratorId, { ...collaborator, status: 'revoked' });
          }
        },
      );
    },

    createShare(workspaceId, mode, expiresAt = null) {
      return this._mutate(
        workspaceId,
        () => shareService.createShare(workspaceId, mode, expiresAt),
        (share) => this.shares.unshift(share),
      );
    },

    deleteShare(workspaceId, shareId) {
      return this._mutate(
        workspaceId,
        () => shareService.deleteShare(workspaceId, shareId),
        () => {
          this.shares = this.shares.filter((s) => s.id !== shareId);
        },
      );
    },

    async fetchSharePreview(token) {
      return shareService.getSharePreview(token);
    },

    async redeemShare(token) {
      return shareService.redeemShare(token);
    },

    /**
     * Persist a share token across the OAuth redirect (login/signup), so it can be re-redeemed
     * automatically once the user is authenticated. With storage disabled the login still runs;
     * the user then lands on the workspace list and opens the link again, now logged in.
     */
    setPendingShareToken(token) {
      try {
        sessionStorage.setItem(PENDING_SHARE_TOKEN_KEY, token);
      } catch {
        // storage disabled, see above
      }
    },

    /**
     * Read and clear the pending share token, if any (call once after handling the auth callback).
     */
    consumePendingShareToken() {
      try {
        const token = sessionStorage.getItem(PENDING_SHARE_TOKEN_KEY);
        sessionStorage.removeItem(PENDING_SHARE_TOKEN_KEY);
        return token;
      } catch {
        return null;
      }
    },

    /**
     * Reset the people/links lists and mark which workspace the dialog is now showing.
     */
    setActiveWorkspace(workspaceId) {
      this.activeWorkspaceId = workspaceId;
      this.collaborators = [];
      this.shares = [];
    },

    reset() {
      Object.assign(this, getDefaults());
    },
  },
});
