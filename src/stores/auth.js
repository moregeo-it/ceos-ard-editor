import { defineStore } from 'pinia';
import router from '@/router';
import authService from '@/services/auth.service';
import sessionService from '@/services/session.service';

const getDefaults = () => ({
  userId: null,
  username: null,
  provider: null,
  expiresAt: null,
  isAuthenticated: false,
  isLoading: false,
  isPendingReauth: false,
});

let listeningForOtherTabs = false;

export const useAuthStore = defineStore('auth', {
  state: () => getDefaults(),

  getters: {
    getUsername: (state) => state.username || 'Guest',

    // The session cookie expires with the JWT, so after this the server refuses every request
    isSessionExpired: (state) => !state.expiresAt || Date.now() >= state.expiresAt,

    userInfo: (state) => ({
      id: state.userId,
      username: state.username,
      provider: state.provider,
    }),
  },

  actions: {
    loginWithGitHub() {
      authService.loginWithGitHub();
    },

    loginWithGoogle() {
      authService.loginWithGoogle();
    },

    /**
     * After the OAuth callback set the session cookie: learn who is logged in and until when.
     * Rejects with `status` 401 when the browser didn't send the cookie back.
     */
    async completeLogin() {
      const session = await authService.fetchSession();
      this.applySession(session);
      return session;
    },

    /** Take over a session (this tab's login or a popup reauthentication) and share it with other tabs. */
    applySession(session) {
      sessionService.save(session);
      this._setSession(session);
    },

    /**
     * Restore session from localStorage on app load
     */
    async restoreSession() {
      this.isLoading = true;
      try {
        const session = sessionService.load();
        if (!session || Date.now() >= session.expiresAt) {
          this.clearAuth();
          return false;
        }
        this._setSession(session);
        this._confirmSession();
        return true;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * The stored session is only what this browser last knew; check it against the cookie without
     * holding up startup. A dead cookie signs out, another account's cookie reloads, and a network
     * error keeps the stored session (the next request's 401 still asks for a new login).
     */
    async _confirmSession() {
      const checked = this.expiresAt;
      try {
        this._takeOver(await authService.fetchSession());
      } catch (error) {
        if (error.status !== 401) {
          return;
        }
        // Another tab may have logged in while this request, sent with the old cookie, was in flight
        const stored = sessionService.load();
        if (stored && stored.expiresAt !== checked) {
          this._takeOver(stored);
          return;
        }
        this.clearAuth();
        // Wait for the first navigation (lazy routes), so a share link isn't mistaken for a protected page
        await router.isReady().catch(() => {});
        if (router.currentRoute.value.meta.requiresAuth) {
          router.push({ name: 'landing' });
        }
      }
    },

    _takeOver(session) {
      const otherUser = session.userId !== this.userId;
      this.applySession(session);
      if (otherUser) {
        window.location.reload();
      }
    },

    /** Stays logged in when the server couldn't end the session, since its cookie would stay valid. */
    async logout() {
      await authService.logout();
      this.clearAuth();
      router.push({ name: 'landing' });
    },

    /** Forget the session here and in every other tab. */
    clearAuth() {
      Object.assign(this, getDefaults());
      sessionService.clear();
    },

    setPendingReauth() {
      // Nothing to renew once logged out, e.g. when another tab's logout closes this tab's socket
      if (this.isAuthenticated) {
        this.isPendingReauth = true;
      }
    },

    updateAuthAfterReauth(session) {
      this.applySession(session);
    },

    /**
     * Follow logins and logouts of other tabs. A reauthentication there renews the shared cookie,
     * so this tab takes over the new session, which also closes its login dialog.
     */
    listenForOtherTabs() {
      if (listeningForOtherTabs) {
        return;
      }
      listeningForOtherTabs = true;
      window.addEventListener('storage', (event) => {
        // key is null when the whole storage was cleared
        if (event.key !== sessionService.KEY && event.key !== null) {
          return;
        }
        const session = sessionService.parse(event.newValue);
        if (session && (!this.isAuthenticated || session.userId !== this.userId)) {
          // A new login: rerun what this tab showed for the previous (or no) account, e.g. the
          // landing page's login button or a share link's redemption
          window.location.reload();
        } else if (session) {
          this._setSession(session);
        } else if (this.isAuthenticated) {
          Object.assign(this, getDefaults());
          router.push({ name: 'landing' });
        }
      });
    },

    _setSession(session) {
      this.userId = session.userId;
      this.username = session.username;
      this.provider = session.provider;
      this.expiresAt = session.expiresAt;
      this.isAuthenticated = true;
      this.isPendingReauth = false;
    },
  },
});
