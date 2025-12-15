// src/services/auth.service.js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export default {
  /**
   * Initiate GitHub OAuth login
   */
  loginWithGitHub() {
    window.location.href = `${API_BASE_URL}/auth/login?identity_provider=github`
  },

  /**
   * Initiate Google OAuth login
   */
  loginWithGoogle() {
    window.location.href = `${API_BASE_URL}/auth/login?identity_provider=google`
  },

  /**
   * Parse authentication callback URL parameters
   */
  parseAuthCallback(searchParams) {
    const accessToken = searchParams.get('access_token')
    const tokenType = searchParams.get('token_type')
    const expiresIn = searchParams.get('expires_in')
    const userId = searchParams.get('user_id')
    const username = searchParams.get('username')
    const provider = searchParams.get('provider')

    // Validate required parameters
    if (!accessToken) {
      throw new Error('Missing access_token in callback')
    }
    if (!userId || !username) {
      throw new Error('Missing user information in callback')
    }

    return {
      accessToken,
      tokenType: tokenType || 'Bearer',
      expiresIn: expiresIn ? parseInt(expiresIn) : 3600, // Default 1 hour
      userId,
      username,
      provider: provider || 'unknown'
    }
  },

  /**
   * Logout - revoke token on backend
   */
  async logout(accessToken) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
    } catch (error) {
      console.error('Logout error:', error)
    }
  },

  /**
   * Verify token is still valid (optional health check)
   */
  async verifyToken(accessToken) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      return response.ok
    } catch (error) {
      return false
    }
  }
}