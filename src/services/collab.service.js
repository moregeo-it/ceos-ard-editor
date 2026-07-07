import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useAuthStore } from '@/stores/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const PRESENCE_COLORS = [
  '#f94144',
  '#f3722c',
  '#f9c74f',
  '#90be6d',
  '#43aa8b',
  '#577590',
  '#277da1',
];

function colorForUser(userId) {
  if (!userId) return PRESENCE_COLORS[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}

function wsBaseUrl() {
  return API_BASE_URL.replace(/^http/, 'ws');
}

/**
 * Opens a collaborative session for a single file. The room is identified by
 * workspaceId + filePath and mirrors the FastAPI websocket route
 * `/workspaces/{workspace_id}/collab/{file_path:path}`.
 */
export function connect(workspaceId, filePath) {
  const authStore = useAuthStore();
  const ydoc = new Y.Doc();
  const roomName = `workspaces/${workspaceId}/collab/${encodeURIComponent(filePath)}`;
  const provider = new WebsocketProvider(wsBaseUrl(), roomName, ydoc, {
    params: { authorization: authStore.accessToken },
  });
  const ytext = ydoc.getText('content');

  provider.awareness.setLocalStateField('user', {
    name: authStore.getUsername,
    color: colorForUser(authStore.userId),
  });

  return { ydoc, ytext, awareness: provider.awareness, provider };
}

export function disconnect(collabDoc) {
  if (!collabDoc) return;
  collabDoc.provider.destroy();
  collabDoc.ydoc.destroy();
}
