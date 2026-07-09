const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * Real-time workspace event types emitted by the backend SSE stream.
 * Keep in sync with `EventType` in the server's app/schemas/events.py.
 */
export const WORKSPACE_EVENT_TYPES = [
  'file.saved',
  'file.created',
  'file.deleted',
  'file.renamed',
  'file.reverted',
  'file.committed',
  'share.revoked',
  'workspace.archived',
  'workspace.deleted',
];

/**
 * Open a Server-Sent Events connection to a workspace's real-time change stream.
 *
 * Native EventSource cannot set request headers, so the JWT is passed as a query param -
 * the backend's `get_jwt_token` accepts `?authorization=<token>` (the same mechanism
 * PreviewPane uses for asset URLs).
 *
 * @param {Object} params
 * @param {string} params.workspaceId
 * @param {string} params.token - Raw JWT access token (not the "Bearer " header form).
 * @param {(event: Object) => void} params.onEvent - Called with each parsed event envelope.
 * @param {() => void} [params.onOpen]
 * @param {(event: Event) => void} [params.onError]
 * @returns {{ close: () => void }}
 */
export function openWorkspaceEvents({ workspaceId, token, onEvent, onOpen, onError }) {
  const url = `${API_BASE_URL}/workspaces/${workspaceId}/events?authorization=${encodeURIComponent(token)}`;
  const source = new EventSource(url);

  source.onopen = () => onOpen?.();
  source.onerror = (event) => onError?.(event);

  for (const type of WORKSPACE_EVENT_TYPES) {
    source.addEventListener(type, (message) => {
      let data;
      try {
        data = JSON.parse(message.data);
      } catch {
        return; // Ignore malformed payloads.
      }
      onEvent?.(data);
    });
  }

  return {
    close: () => source.close(),
  };
}
