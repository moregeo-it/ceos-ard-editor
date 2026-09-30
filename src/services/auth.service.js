// src/services/auth.service.js
import { CLIENT_ID, CLIENT_ID_HEADER } from '@/services/client-id';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default {
  /**
   * Initiate GitHub OAuth login
   */
  loginWithGitHub() {
    window.location.href = `${API_BASE_URL}/auth/login?identity_provider=github`;
  },

  /**
   * Initiate Google OAuth login
   */
  loginWithGoogle() {
    window.location.href = `${API_BASE_URL}/auth/login?identity_provider=google`;
  },

  /**
   * Read the session the login cookie belongs to. Rejects with `status` 401 when the browser sent
   * no cookie, e.g. because it blocks cookies for the API host.
   * @returns {Promise<import('./session.service').Session>}
   */
  async fetchSession() {
    const response = await fetch(`${API_BASE_URL}/auth/user`, { credentials: 'include' });
    if (!response.ok) {
      const error = new Error(`Failed to read the session (status ${response.status})`);
      error.status = response.status;
      throw error;
    }
    const user = await response.json();
    return {
      userId: user.id,
      username: user.username,
      provider: user.identity_provider,
      expiresAt: Date.parse(user.expires_at),
    };
  },

  /**
   * End the session on the backend, which clears the session cookie. Rejects when that failed;
   * a 401 means the session had already ended.
   */
  async logout() {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { [CLIENT_ID_HEADER]: CLIENT_ID },
    });
    if (!response.ok && response.status !== 401) {
      throw new Error(`Logout failed (status ${response.status})`);
    }
  },

  /**
   * Check if popup was blocked by browser
   */
  isPopupBlocked(popup) {
    return !popup || popup.closed || typeof popup.closed === 'undefined';
  },

  /**
   * Reauthenticate using popup window (preserves application state)
   */
  reauthenticateWithPopup(provider) {
    return new Promise((resolve, reject) => {
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      // Open OAuth endpoint in popup window
      const authUrl = `${API_BASE_URL}/auth/login?identity_provider=${provider}`;
      const popup = window.open(
        authUrl,
        'oauth_reauth',
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`,
      );

      // Check if popup was blocked
      if (this.isPopupBlocked(popup)) {
        reject(new Error('POPUP_BLOCKED'));
        return;
      }

      // Listen for message from popup
      const messageHandler = (event) => {
        // Security: validate origin
        if (event.origin !== window.location.origin) {
          return;
        }

        if (event.data.type === 'auth_success') {
          window.removeEventListener('message', messageHandler);
          clearInterval(checkClosed);

          // Send confirmation back to popup so it can close
          popup.postMessage({ type: 'popup_can_close' }, window.location.origin);

          resolve(event.data.data);
        } else if (event.data.type === 'auth_error') {
          window.removeEventListener('message', messageHandler);
          clearInterval(checkClosed);

          // Send confirmation back to popup so it can close
          popup.postMessage({ type: 'popup_can_close' }, window.location.origin);

          reject(new Error(event.data.error || 'Authentication failed'));
        }
      };

      window.addEventListener('message', messageHandler);

      // Check if popup was closed manually
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageHandler);
          reject(new Error('POPUP_CLOSED'));
        }
      }, 500);
    });
  },
};
