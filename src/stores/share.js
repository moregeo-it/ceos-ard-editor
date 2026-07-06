import { defineStore } from 'pinia';
import shareService from '@/services/share.service';

const PENDING_SHARE_TOKEN_KEY = 'ceos_ard_editor_pending_share_token';

const getDefaults = () => ({
  shares: [],
  shareLinks: [],
  isLoading: false,
  isMutating: false,
});

export const useShareStore = defineStore('share', {
  state: () => getDefaults(),

  actions: {
    async fetchShares(workspaceId) {
      this.isLoading = true;
      try {
        const response = await shareService.listShares(workspaceId);
        this.shares = response.shares || [];
      } finally {
        this.isLoading = false;
      }
    },

    async fetchShareLinks(workspaceId) {
      this.isLoading = true;
      try {
        const response = await shareService.listShareLinks(workspaceId);
        this.shareLinks = response.shareLinks || [];
      } finally {
        this.isLoading = false;
      }
    },

    async createShares(workspaceId, githubUsernames, mode) {
      this.isMutating = true;
      try {
        const response = await shareService.createShares(workspaceId, githubUsernames, mode);
        const newShares = response.shares || [];
        // Merge: replace any existing shares with the same id, append the rest
        for (const share of newShares) {
          const index = this.shares.findIndex((s) => s.id === share.id);
          if (index !== -1) {
            this.shares[index] = share;
          } else {
            this.shares.unshift(share);
          }
        }
        return newShares;
      } finally {
        this.isMutating = false;
      }
    },

    async updateShare(workspaceId, shareId, mode) {
      this.isMutating = true;
      try {
        const updated = await shareService.updateShare(workspaceId, shareId, mode);
        const index = this.shares.findIndex((s) => s.id === shareId);
        if (index !== -1) {
          this.shares[index] = updated;
        }
        return updated;
      } finally {
        this.isMutating = false;
      }
    },

    async revokeShare(workspaceId, shareId) {
      this.isMutating = true;
      try {
        await shareService.revokeShare(workspaceId, shareId);
        this.shares = this.shares.filter((s) => s.id !== shareId);
      } finally {
        this.isMutating = false;
      }
    },

    async createShareLink(workspaceId, mode, expiresAt = null) {
      this.isMutating = true;
      try {
        const link = await shareService.createShareLink(workspaceId, mode, expiresAt);
        this.shareLinks.unshift(link);
        return link;
      } finally {
        this.isMutating = false;
      }
    },

    async updateShareLink(workspaceId, linkId, updates) {
      this.isMutating = true;
      try {
        const updated = await shareService.updateShareLink(workspaceId, linkId, updates);
        const index = this.shareLinks.findIndex((l) => l.id === linkId);
        if (index !== -1) {
          this.shareLinks[index] = updated;
        }
        return updated;
      } finally {
        this.isMutating = false;
      }
    },

    async deleteShareLink(workspaceId, linkId) {
      this.isMutating = true;
      try {
        await shareService.deleteShareLink(workspaceId, linkId);
        this.shareLinks = this.shareLinks.filter((l) => l.id !== linkId);
      } finally {
        this.isMutating = false;
      }
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
  },
});
