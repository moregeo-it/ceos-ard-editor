const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// The server pings idle connections every 20 s (HEARTBEAT_SECONDS in
// ceos-ard-server/app/services/events_service.py). A socket silent for longer than this is dead,
// even when the browser has not noticed yet (e.g. a dropped network path).
const SILENCE_TIMEOUT_MS = 50000;

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
 * The JWT goes in the `authorization` query param (browsers can't set headers on a handshake; a
 * session cookie will replace it, see ceos-ard-server#98). The client never sends anything.
 *
 * @param {Object} params
 * @param {string} params.workspaceId
 * @param {string} params.token - Raw JWT access token (not the "Bearer " header form).
 * @param {string} [params.clientId] - This page load's id, see `@/utils/client-id`.
 * @param {(event: Object) => void} params.onEvent - Called with each parsed event envelope.
 * @param {() => void} [params.onOpen]
 * @param {(info: {code: number, reason: string}) => void} [params.onClose] - Any close not
 *   requested by the caller, including a heartbeat timeout; the code drives the store's
 *   reconnect logic.
 * @returns {{ close: () => void }}
 */
export function openWorkspaceConnection({
  workspaceId,
  token,
  clientId,
  onEvent,
  onOpen,
  onClose,
}) {
  const params = new URLSearchParams({ authorization: token });
  if (clientId) {
    params.set('client_id', clientId);
  }
  const socket = new WebSocket(
    `${toWebSocketUrl(API_BASE_URL)}/workspaces/${workspaceId}/ws?${params}`,
  );
  let closedByCaller = false;
  let silenceTimer = null;

  // Every message, pings included, proves the connection is alive. Closing from here is not a
  // caller close, so `onclose` runs the reconnect path.
  const armSilenceTimer = () => {
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => socket.close(), SILENCE_TIMEOUT_MS);
  };

  socket.onopen = () => {
    armSilenceTimer();
    onOpen?.();
  };

  socket.onmessage = (message) => {
    armSilenceTimer();
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

  // `onclose` always fires (after `onerror`, if any): the single reconnect trigger.
  socket.onclose = (event) => {
    clearTimeout(silenceTimer);
    if (!closedByCaller) {
      onClose?.({ code: event.code, reason: event.reason });
    }
  };

  return {
    close: () => {
      closedByCaller = true;
      clearTimeout(silenceTimer);
      socket.close();
    },
  };
}
