import { defineStore } from 'pinia';
import router from '@/router';
import authService from '@/services/auth.service';
import sessionService from '@/services/session.service';
import { useEditorStore } from '@/stores/editor';

const getDefaults = () => ({
  userId: null,
  username: null,
  provider: null,
  expiresAt: null,
  isAuthenticated: false,
  isLoading: false,
  isPendingReauth: false,
  // Why: 'expired', 'logged_out' (in another tab) or 'other_account' (logged in there)
  reauthReason: null,
  otherAccount: null,
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

    /**
     * Handle OAuth callback after successful authentication
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
     * holding up startup. A dead cookie signs out, another account's cookie reloads (with unsaved
     * edits, both ask for a new login instead), and a network error keeps the stored session.
     */
    async _confirmSession() {
      const checked = this.expiresAt;
      try {
        const session = await authService.fetchSession();
        // Logged out or in again meanwhile, here or in another tab: that newer state wins
        if (this.expiresAt !== checked || sessionService.load()?.expiresAt !== checked) {
          return;
        }
        this.updateAuthAfterReauth(session);
      } catch (error) {
        if (error.status !== 401) {
          return;
        }
        // Another tab may have logged in while this request, sent with the old cookie, was in flight
        const stored = sessionService.load();
        if (stored && stored.expiresAt !== checked) {
          this.updateAuthAfterReauth(stored);
          return;
        }
        if (useEditorStore().hasUnsavedChanges) {
          this.setPendingReauth('logged_out');
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

    /**
     * Ask for a new login instead of giving up the page, so unsaved edits survive. `reason` tells
     * the dialog what happened; `otherAccount` names the account another tab logged in with.
     */
    setPendingReauth(reason = 'expired', otherAccount = null) {
      // Nothing to renew once logged out, e.g. when another tab's logout closes this tab's socket
      if (!this.isAuthenticated) {
        return;
      }
      // A 401 can trail a cross-tab event, so 'expired' never replaces what another tab reported
      if (!this.isPendingReauth || reason !== 'expired') {
        this.reauthReason = reason;
        this.otherAccount = otherAccount;
      }
      this.isPendingReauth = true;
    },

    /** Continue as this session (login dialog, startup check), unless the edits here belong to another account. */
    updateAuthAfterReauth(session) {
      const otherUser = session.userId !== this.userId;
      if (otherUser && useEditorStore().hasUnsavedChanges) {
        this.setPendingReauth('other_account', session.username);
        return;
      }
      this.applySession(session);
      if (otherUser) {
        window.location.reload();
      }
    },

    /**
     * Follow logins and logouts of other tabs. A reauthentication there renews the shared cookie,
     * so this tab takes over the new session, which also closes its login dialog. A logout or
     * another account's login would end this page; with unsaved edits the login dialog is shown
     * instead, so they can still be saved.
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
        const unsaved = this.isAuthenticated && useEditorStore().hasUnsavedChanges;
        if (session && (!this.isAuthenticated || session.userId !== this.userId)) {
          if (unsaved) {
            this.setPendingReauth('other_account', session.username);
          } else {
            // A new login: rerun what this tab showed for the previous (or no) account, e.g. the
            // landing page's login button or a share link's redemption
            window.location.reload();
          }
        } else if (session) {
          this._setSession(session);
        } else if (unsaved) {
          this.setPendingReauth('logged_out');
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
      this.reauthReason = null;
      this.otherAccount = null;
    },
  },
});
