// src/services/auth.service.js
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
   * Parse authentication callback URL parameters
   */
  parseAuthCallback(searchParams) {
    const accessToken = searchParams.get('access_token');
    const tokenType = searchParams.get('token_type');
    const expiresIn = searchParams.get('expires_in');
    const userId = searchParams.get('user_id');
    const username = searchParams.get('username');
    const provider = searchParams.get('provider');

    // Validate required parameters
    if (!accessToken) {
      throw new Error('Missing access_token in callback');
    }
    if (!userId || !username) {
      throw new Error('Missing user information in callback');
    }

    return {
      accessToken,
      tokenType: tokenType || 'Bearer',
      expiresIn: expiresIn ? parseInt(expiresIn) : 3600, // Default 1 hour
      userId,
      username,
      provider: provider || 'unknown',
    };
  },

  /**
   * Logout - revoke token on backend
   */
  async logout(accessToken) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch (error) {
      console.error('Logout error:', error);
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
          popup.close();
          resolve(event.data.data);
        } else if (event.data.type === 'auth_error') {
          window.removeEventListener('message', messageHandler);
          clearInterval(checkClosed);
          popup.close();
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
