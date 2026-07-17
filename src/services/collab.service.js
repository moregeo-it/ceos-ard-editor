const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * Derive the WebSocket origin from the HTTP API base URL:
 * http://host -> ws://host, https://host -> wss://host.
 */
function toWebSocketUrl(httpUrl) {
  return httpUrl.replace(/^http/i, 'ws');
}

/**
 * Open a WebSocket connection to a workspace's real-time change stream.
 *
 * Replaces the former SSE (EventSource) transport. Browsers can't set headers on a WebSocket
 * handshake, so the JWT goes in a query param - the backend's collab gateway reads `?authorization=`
 * (the same mechanism the SSE stream used).
 *
 * The callback surface matches the former `openWorkspaceEvents` so the realtime store is unchanged:
 * `onOpen` fires once connected, `onEvent` for each parsed event envelope, `onError` when the socket
 * closes or fails (which drives the store's reconnect/backoff logic).
 *
 * @param {Object} params
 * @param {string} params.workspaceId
 * @param {string} params.token - Raw JWT access token (not the "Bearer " header form).
 * @param {(event: Object) => void} params.onEvent - Called with each parsed event envelope.
 * @param {() => void} [params.onOpen]
 * @param {() => void} [params.onError]
 * @returns {{ close: () => void }}
 */
export function openWorkspaceConnection({ workspaceId, token, onEvent, onOpen, onError }) {
  const url = `${toWebSocketUrl(API_BASE_URL)}/workspaces/${workspaceId}/ws?authorization=${encodeURIComponent(token)}`;
  const socket = new WebSocket(url);
  let closedByCaller = false;

  socket.onopen = () => onOpen?.();

  socket.onmessage = (message) => {
    let data;
    try {
      data = JSON.parse(message.data);
    } catch {
      return; // Ignore malformed payloads.
    }
    if (!data || data.type === 'ping') {
      return; // Server heartbeat, not a workspace event.
    }
    onEvent?.(data);
  };

  // `onclose` always fires (after `onerror`, if any), so use it as the single reconnect trigger.
  // The server also closes after a terminal event (share.revoked / workspace.deleted) or a
  // forced resync; the store cancels the pending reconnect once it handles those.
  socket.onclose = () => {
    if (!closedByCaller) {
      onError?.();
    }
  };

  return {
    close: () => {
      closedByCaller = true;
      socket.close();
    },
  };
}
