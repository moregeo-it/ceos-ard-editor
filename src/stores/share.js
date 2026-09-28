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

    /** Run a change with `isMutating` set, which disables the dialog's controls meanwhile. */
    async _mutate(fn) {
      this.isMutating = true;
      try {
        return await fn();
      } finally {
        this.isMutating = false;
      }
    },

    createShares(workspaceId, githubUsernames, mode) {
      return this._mutate(async () => {
        const newShares =
          (await shareService.createShares(workspaceId, githubUsernames, mode)) || [];
        // Merge: replace any existing shares with the same id, prepend the rest
        for (const share of newShares) {
          if (!replaceById(this.shares, share.id, share)) {
            this.shares.unshift(share);
          }
        }
        return newShares;
      });
    },

    updateShare(workspaceId, shareId, mode) {
      return this._mutate(async () => {
        const updated = await shareService.updateShare(workspaceId, shareId, mode);
        replaceById(this.shares, shareId, updated);
        return updated;
      });
    },

    revokeShare(workspaceId, shareId) {
      return this._mutate(async () => {
        await shareService.revokeShare(workspaceId, shareId);
        // Revoke returns 204 (no body). A revoked invitee isn't dropped from the list - it stays,
        // shown greyed-out as "revoked" (that's what a reload returns and what the dialog renders),
        // so flip the row's status in place instead of removing it.
        const share = this.shares.find((s) => s.id === shareId);
        if (share) {
          replaceById(this.shares, shareId, { ...share, status: 'revoked' });
        }
      });
    },

    createShareLink(workspaceId, mode, expiresAt = null) {
      return this._mutate(async () => {
        const link = await shareService.createShareLink(workspaceId, mode, expiresAt);
        this.shareLinks.unshift(link);
        return link;
      });
    },

    updateShareLink(workspaceId, linkId, updates) {
      return this._mutate(async () => {
        const updated = await shareService.updateShareLink(workspaceId, linkId, updates);
        replaceById(this.shareLinks, linkId, updated);
        return updated;
      });
    },

    deleteShareLink(workspaceId, linkId) {
      return this._mutate(async () => {
        await shareService.deleteShareLink(workspaceId, linkId);
        this.shareLinks = this.shareLinks.filter((l) => l.id !== linkId);
      });
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
