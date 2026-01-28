import { useAuthStore } from '@/stores/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * Fetch with automatic authentication
 */
export async function fetchWithAuth(endpoint, options = {}) {
  const authStore = useAuthStore();

  // Check if user is authenticated
  if (!authStore.isAuthenticated) {
    throw new Error('User is not authenticated');
  }

  // Check if token is expired
  if (authStore.isTokenExpired) {
    authStore.logout();
    throw new Error('Session expired. Please login again.');
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    Authorization: authStore.authorizationHeader,
  };

  const response = await fetch(url, { ...options, headers });

  // Handle 401 Unauthorized
  if (response.status === 401) {
    authStore.logout();
    throw new Error('Authentication failed. Please login again.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const errorMessage = parseErrorMessage(error, response.status);
    const err = new Error(errorMessage);
    err.status = response.status;
    err.details = error;
    throw err;
  }

  return response;
}

/**
 * Parse error message from API response
 */
function parseErrorMessage(errorData, status) {
  // Check for message in various formats
  if (errorData.message) return errorData.message;
  if (errorData.error) return errorData.error;
  if (errorData.detail) return errorData.detail;

  // Handle validation errors (422)
  if (status === 422 && errorData.errors) {
    const fieldErrors = Object.entries(errorData.errors)
      .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
      .join('; ');
    return `Validation failed: ${fieldErrors}`;
  }

  // Default messages by status code
  switch (status) {
    case 400:
      return 'Invalid request. Please check your input.';
    case 403:
      return 'Permission denied. You do not have access to this resource.';
    case 404:
      return 'Resource not found.';
    case 409:
      return 'Conflict. This action cannot be completed.';
    case 422:
      return 'Validation failed. Please check your input.';
    case 500:
      return 'Server error. Please try again later.';
    case 503:
      return 'Service unavailable. Please try again later.';
    default:
      return `Request failed with status ${status}`;
  }
}

/**
 * Helper methods for common HTTP methods
 */
export const api = {
  async getText(endpoint, options = {}) {
    const response = await fetchWithAuth(endpoint, { ...options, method: 'GET' });
    return response.text();
  },

  async getBlob(endpoint, options = {}) {
    const response = await fetchWithAuth(endpoint, { ...options, method: 'GET' });
    return response.blob();
  },

  async get(endpoint, options = {}) {
    const response = await fetchWithAuth(endpoint, { ...options, method: 'GET' });
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      return response.text();
    }

    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return null;
    }

    return response.json();
  },

  async post(endpoint, data, options = {}) {
    const response = await fetchWithAuth(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async putRaw(endpoint, body, options = {}) {
    const response = await fetchWithAuth(endpoint, {
      ...options,
      method: 'PUT',
      body,
    });
    return response.json();
  },

  async put(endpoint, data, options = {}) {
    return await api.putRaw(endpoint, JSON.stringify(data), options);
  },

  async patch(endpoint, data, options = {}) {
    const response = await fetchWithAuth(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async delete(endpoint, options = {}) {
    const response = await fetchWithAuth(endpoint, { ...options, method: 'DELETE' });
    // Check if response has content (204 No Content has no body)
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return null;
    }
    return response.json();
  },
};

export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
