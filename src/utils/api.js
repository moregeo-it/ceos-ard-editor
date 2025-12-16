import { useAuthStore } from '@/stores/auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

/**
 * Fetch with automatic authentication
 */
export async function fetchWithAuth(endpoint, options = {}) {
  const authStore = useAuthStore()

  // Check if user is authenticated
  if (!authStore.isAuthenticated) {
    throw new Error('User is not authenticated')
  }

  // Check if token is expired
  if (authStore.isTokenExpired) {
    authStore.logout()
    throw new Error('Session expired. Please login again.')
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    Authorization: authStore.authorizationHeader,
  }

  const response = await fetch(url, { ...options, headers })

  // Handle 401 Unauthorized
  if (response.status === 401) {
    authStore.logout()
    throw new Error('Authentication failed. Please login again.')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  return response
}

/**
 * Helper methods for common HTTP methods
 */
export const api = {
  async get(endpoint, options = {}) {
    const response = await fetchWithAuth(endpoint, { ...options, method: 'GET' })
    return response.json()
  },

  async post(endpoint, data, options = {}) {
    const response = await fetchWithAuth(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.json()
  },

  async put(endpoint, data, options = {}) {
    const response = await fetchWithAuth(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return response.json()
  },

  async delete(endpoint, options = {}) {
    const response = await fetchWithAuth(endpoint, { ...options, method: 'DELETE' })
    // Check if response has content (204 No Content has no body)
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return null
    }
    return response.json()
  },
}
