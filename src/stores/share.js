import { defineStore } from 'pinia';
import shareService from '@/services/share.service';

const PENDING_SHARE_TOKEN_KEY = 'ceos_ard_editor_pending_share_token';

const getDefaults = () => ({
  shares: [],
  shareLinks: [],
  isLoadingShares: false,
  isLoadingShareLinks: false,
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

    async fetchShareLinks(workspaceId) {
      this.isLoadingShareLinks = true;
      try {
        const response = await shareService.listShareLinks(workspaceId);
        // Ignore responses for a workspace the dialog has since moved away from.
        if (workspaceId !== this.activeWorkspaceId) return;
        this.shareLinks = response || [];
      } finally {
        if (workspaceId === this.activeWorkspaceId) this.isLoadingShareLinks = false;
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

    createShares(workspaceId, githubUsernames, mode) {
      return this._mutate(
        workspaceId,
        () => shareService.createShares(workspaceId, githubUsernames, mode),
        (newShares) => {
          // Merge: replace any existing shares with the same id, prepend the rest
          for (const share of newShares || []) {
            if (!replaceById(this.shares, share.id, share)) {
              this.shares.unshift(share);
            }
          }
        },
      );
    },

    updateShare(workspaceId, shareId, mode) {
      return this._mutate(
        workspaceId,
        () => shareService.updateShare(workspaceId, shareId, mode),
        (updated) => replaceById(this.shares, shareId, updated),
      );
    },

    revokeShare(workspaceId, shareId) {
      return this._mutate(
        workspaceId,
        () => shareService.revokeShare(workspaceId, shareId),
        () => {
          // Revoke returns 204 (no body). A revoked invitee isn't dropped from the list - it stays,
          // shown greyed-out as "revoked" (that's what a reload returns and what the dialog renders),
          // so flip the row's status in place instead of removing it.
          const share = this.shares.find((s) => s.id === shareId);
          if (share) {
            replaceById(this.shares, shareId, { ...share, status: 'revoked' });
          }
        },
      );
    },

    createShareLink(workspaceId, mode, expiresAt = null) {
      return this._mutate(
        workspaceId,
        () => shareService.createShareLink(workspaceId, mode, expiresAt),
        (link) => this.shareLinks.unshift(link),
      );
    },

    updateShareLink(workspaceId, linkId, updates) {
      return this._mutate(
        workspaceId,
        () => shareService.updateShareLink(workspaceId, linkId, updates),
        (updated) => replaceById(this.shareLinks, linkId, updated),
      );
    },

    deleteShareLink(workspaceId, linkId) {
      return this._mutate(
        workspaceId,
        () => shareService.deleteShareLink(workspaceId, linkId),
        () => {
          this.shareLinks = this.shareLinks.filter((l) => l.id !== linkId);
        },
      );
    },

    async redeemShareLink(token) {
      return shareService.redeemShareLink(token);
    },

    /**
     * Persist a share token across the OAuth redirect (login/signup), so it can be re-redeemed
     * automatically once the user is authenticated.
     */
    setPendingShareToken(token) {
      sessionStorage.setItem(PENDING_SHARE_TOKEN_KEY, token);
    },

    /**
     * Read and clear the pending share token, if any (call once after handling the auth callback).
     */
    consumePendingShareToken() {
      const token = sessionStorage.getItem(PENDING_SHARE_TOKEN_KEY);
      sessionStorage.removeItem(PENDING_SHARE_TOKEN_KEY);
      return token;
    },

    /**
     * Reset the people/links lists and mark which workspace the dialog is now showing.
     */
    setActiveWorkspace(workspaceId) {
      this.activeWorkspaceId = workspaceId;
      this.shares = [];
      this.shareLinks = [];
    },

    reset() {
      Object.assign(this, getDefaults());
    },
  },
});
