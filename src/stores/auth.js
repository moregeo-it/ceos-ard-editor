import { defineStore } from 'pinia';
import router from '@/router';
import authService from '@/services/auth.service';
import tokenService from '@/services/token.service';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: null,
    tokenType: 'Bearer',
    userId: null,
    username: null,
    provider: null,
    expiresAt: null,
    isAuthenticated: false,
    isLoading: false,
  }),

  getters: {
    /**
     * Get username for display
     */
    getUsername: (state) => state.username || 'Guest',

    /**
     * Check if token is expired
     */
    isTokenExpired: (state) => {
      if (!state.expiresAt) return true;
      return Date.now() >= state.expiresAt;
    },

    /**
     * Get Authorization header value
     */
    authorizationHeader: (state) => {
      if (!state.accessToken) return null;
      return `${state.tokenType} ${state.accessToken}`;
    },

    /**
     * Get user info object
     */
    userInfo: (state) => ({
      id: state.userId,
      username: state.username,
      provider: state.provider,
    }),
  },

  actions: {
    /**
     * Initiate GitHub login
     */
    loginWithGitHub() {
      authService.loginWithGitHub();
    },

    /**
     * Initiate Google login
     */
    loginWithGoogle() {
      authService.loginWithGoogle();
    },

    /**
     * Handle OAuth callback after successful authentication
     */
    handleAuthCallback(searchParams) {
      try {
        // Parse authentication data from URL
        const authData = authService.parseAuthCallback(searchParams);

        // Save to localStorage
        tokenService.saveAuth(authData);

        // Update store state
        this.accessToken = authData.accessToken;
        this.tokenType = authData.tokenType;
        this.userId = authData.userId;
        this.username = authData.username;
        this.provider = authData.provider;
        this.expiresAt = Date.now() + authData.expiresIn * 1000;
        this.isAuthenticated = true;

        return true;
        // eslint-disable-next-line no-unused-vars
      } catch (error) {
        return false;
      }
    },

    /**
     * Restore session from localStorage on app load
     */
    async restoreSession() {
      this.isLoading = true;

      try {
        const authData = tokenService.getAuth();

        if (!authData || !authData.accessToken) {
          return false;
        }

        // Check if token is expired
        if (tokenService.isTokenExpired()) {
          // Token expired, clear and return false
          this.clearAuth();
          return false;
        }

        // Restore state from localStorage
        this.accessToken = authData.accessToken;
        this.tokenType = authData.tokenType;
        this.userId = authData.userId;
        this.username = authData.username;
        this.provider = authData.provider;
        this.expiresAt = authData.expiresAt;
        this.isAuthenticated = true;

        return true;
        // eslint-disable-next-line no-unused-vars
      } catch (error) {
        this.clearAuth();
        return false;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Logout user
     */
    async logout() {
      try {
        if (this.accessToken) {
          await authService.logout(this.accessToken);
        }
      } finally {
        this.clearAuth();
        router.push({ name: 'landing' });
      }
    },

    /**
     * Clear authentication state
     */
    clearAuth() {
      this.accessToken = null;
      this.tokenType = 'Bearer';
      this.userId = null;
      this.username = null;
      this.provider = null;
      this.expiresAt = null;
      this.isAuthenticated = false;
      tokenService.clearAuth();
    },
  },
});
