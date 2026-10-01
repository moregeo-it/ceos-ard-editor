/**
 * Id of this page load, sent as `X-Client-Id` on requests and as `client_id` on the realtime
 * socket, so the server leaves this tab's own changes out of its stream while other tabs and
 * devices of the same user still receive them. In memory only. The server also requires the
 * header on requests that change data, as cross-site request protection for the session cookie.
 */
export const CLIENT_ID_HEADER = 'X-Client-Id';

function generateClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // No randomUUID in insecure contexts (plain http); unique among one user's tabs is enough.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export const CLIENT_ID = generateClientId();
