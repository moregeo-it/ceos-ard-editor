import { useAuthStore } from '@/stores/auth';
import { CLIENT_ID, CLIENT_ID_HEADER } from '@/utils/client-id';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Resolves when the login dialog closes; shared by every request waiting for it
let dialogClosed = null;

/**
 * Fetch from the API with the session cookie. On a 401 the request waits for the user to log in
 * again and is then sent once more; after a logout or a login as another account it never settles.
 */
export async function fetchWithAuth(endpoint, options = {}) {
  const authStore = useAuthStore();

  // Check if user is authenticated
  if (!authStore.isAuthenticated) {
    throw new Error('User is not authenticated');
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    // Realtime echo filter, and required by the server on requests that change data
    [CLIENT_ID_HEADER]: CLIENT_ID,
  };
  const sentBy = authStore.userId;
  let sentWith;
  const send = () => {
    sentWith = authStore.expiresAt;
    return fetch(url, { ...options, headers, credentials: 'include' });
  };

  if (authStore.isSessionExpired) {
    authStore.setPendingReauth();
  }
  let response = authStore.isPendingReauth ? null : await send();
  if (!response || response.status === 401) {
    // Unless a login since replaced the session the request was sent with
    if (response && authStore.expiresAt === sentWith) {
      authStore.setPendingReauth();
    }
    await loginDialogClosed(authStore);
    // Logged out, or another account logged in: dropped
    if (!authStore.isAuthenticated || authStore.userId !== sentBy) {
      return new Promise(() => {});
    }
    // Once: a second 401 fails like any other error
    response = await send();
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

/** Resolves when the login dialog closes, after a login or a logout; at once if it isn't open. */
function loginDialogClosed(authStore) {
  if (!authStore.isPendingReauth) {
    return Promise.resolve();
  }
  dialogClosed ??= new Promise((resolve) => {
    // Detached: it outlives the component whose request started the wait
    const unsubscribe = authStore.$subscribe(
      () => {
        if (!authStore.isPendingReauth) {
          unsubscribe();
          dialogClosed = null;
          resolve();
        }
      },
      { detached: true },
    );
  });
  return dialogClosed;
}

/**
 * Parse error message from API response
 */
function parseErrorMessage(errorData, status) {
  // Check for message in various formats
  if (typeof errorData.message === 'string') {
    return errorData.message;
  }
  if (typeof errorData.error === 'string') {
    return errorData.error;
  }
  if (typeof errorData.detail === 'string') {
    return errorData.detail;
  }
  // Structured details, e.g. the sync conflict payload {message, conflicting_files}. Without
  // this the message degrades to the generic status text and the useful part is lost; the
  // full object stays available on err.details for callers that need the extra fields.
  if (
    errorData.detail &&
    !Array.isArray(errorData.detail) &&
    typeof errorData.detail === 'object'
  ) {
    if (typeof errorData.detail.message === 'string') {
      return errorData.detail.message;
    }
  }
  if (Array.isArray(errorData.detail)) {
    return errorData.detail
      .map((detail) => {
        if (Array.isArray(detail.loc) && detail.loc.length > 0) {
          if (detail.loc[0] === 'body') {
            detail.loc.shift();
          }
          return `${detail.loc.join('.')} => ${detail.msg}`;
        } else {
          return detail.msg;
        }
      })
      .join('; ');
  }

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

// HTML (previews) as text, no content as null, anything else as JSON
function parseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    return response.text();
  }
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null;
  }
  return response.json();
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
    return parseBody(await fetchWithAuth(endpoint, { ...options, method: 'GET' }));
  },

  async post(endpoint, data, options = {}) {
    const response = await fetchWithAuth(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
    return parseBody(response);
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
