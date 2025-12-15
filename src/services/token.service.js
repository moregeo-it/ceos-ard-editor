// src/services/token.service.js
const TOKEN_KEYS = {
  ACCESS_TOKEN: 'ceos_ard_editor_access_token',
  TOKEN_TYPE: 'ceos_ard_editor_token_type',
  USER_ID: 'ceos_ard_editor_user_id',
  USERNAME: 'ceos_ard_editor_username',
  PROVIDER: 'ceos_ard_editor_provider',
  EXPIRES_AT: 'ceos_ard_editor_expires_at',
}

export default {
  /**
   * Save authentication data to localStorage
   */
  saveAuth({ accessToken, tokenType, expiresIn, userId, username, provider }) {
    const expiresAt = Date.now() + expiresIn * 1000

    localStorage.setItem(TOKEN_KEYS.ACCESS_TOKEN, accessToken)
    localStorage.setItem(TOKEN_KEYS.TOKEN_TYPE, tokenType)
    localStorage.setItem(TOKEN_KEYS.USER_ID, userId)
    localStorage.setItem(TOKEN_KEYS.USERNAME, username)
    localStorage.setItem(TOKEN_KEYS.PROVIDER, provider)
    localStorage.setItem(TOKEN_KEYS.EXPIRES_AT, expiresAt.toString())
  },

  /**
   * Get authentication data from localStorage
   */
  getAuth() {
    const accessToken = localStorage.getItem(TOKEN_KEYS.ACCESS_TOKEN)
    const tokenType = localStorage.getItem(TOKEN_KEYS.TOKEN_TYPE)
    const userId = localStorage.getItem(TOKEN_KEYS.USER_ID)
    const username = localStorage.getItem(TOKEN_KEYS.USERNAME)
    const provider = localStorage.getItem(TOKEN_KEYS.PROVIDER)
    const expiresAt = localStorage.getItem(TOKEN_KEYS.EXPIRES_AT)

    if (!accessToken) return null

    return {
      accessToken,
      tokenType,
      userId,
      username,
      provider,
      expiresAt: expiresAt ? parseInt(expiresAt) : null,
    }
  },

  /**
   * Clear all authentication data
   */
  clearAuth() {
    Object.values(TOKEN_KEYS).forEach((key) => {
      localStorage.removeItem(key)
    })
  },

  /**
   * Check if access token is expired
   */
  isTokenExpired() {
    const expiresAt = localStorage.getItem(TOKEN_KEYS.EXPIRES_AT)
    if (!expiresAt) return true
    return Date.now() >= parseInt(expiresAt)
  },

  /**
   * Get access token for Authorization header
   */
  getAccessToken() {
    return localStorage.getItem(TOKEN_KEYS.ACCESS_TOKEN)
  },

  /**
   * Get full Authorization header value
   */
  getAuthorizationHeader() {
    const accessToken = localStorage.getItem(TOKEN_KEYS.ACCESS_TOKEN)
    const tokenType = localStorage.getItem(TOKEN_KEYS.TOKEN_TYPE) || 'Bearer'

    if (!accessToken) return null

    return `${tokenType} ${accessToken}`
  },
}
