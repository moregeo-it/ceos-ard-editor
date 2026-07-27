import { defineStore } from 'pinia';

import { EVENTS, emit, enqueue } from '@/services/events';
import { openWorkspaceConnection } from '@/services/collab.service';
import { useAuthStore } from './auth';
import { useEditorStore } from './editor';
import { useFilesStore } from './files';
import { useNotificationsStore } from './notifications';

const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30000;

// Kept in module scope (not Pinia state) so the non-serializable WebSocket + timers aren't
// wrapped in a reactive proxy.
let client = null;
let reconnectTimer = null;
let backoff = 0;
let closing = false;
let hasConnected = false; // true once the first open succeeds, so a re-open triggers a resync

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function closeClient() {
  if (client) {
    client.close();
    client = null;
  }
}

const getDefaults = () => ({
  workspaceId: null,
  status: 'idle', // 'idle' | 'connecting' | 'open' | 'reconnecting'
});

/**
 * Manages the realtime WebSocket stream and forwards its events onto the central event bus
 * (see `@/services/events`) with `source: 'remote'`. The store listeners registered in main.js
 * apply them - the same handlers that react to local operations.
 */
export const useRealtimeStore = defineStore('realtime', {
  state: () => getDefaults(),

  actions: {
    /**
     * Open (or re-open) the realtime stream for a workspace. Safe to call repeatedly.
     */
    connect(workspaceId) {
      const auth = useAuthStore();
      if (!auth.accessToken || auth.isTokenExpired) {
        auth.setPendingReauth();
        return;
      }
      // Already connected to this workspace - nothing to do.
      if (client && this.workspaceId === workspaceId) {
        return;
      }

      this.disconnect();
      closing = false;
      hasConnected = false;
      this.workspaceId = workspaceId;
      this._open();
    },

    /**
     * Tear down the connection and stop any pending reconnect.
     */
    disconnect() {
      closing = true;
      clearReconnectTimer();
      closeClient();
      this.status = 'idle';
      this.workspaceId = null;
    },

    reset() {
      this.disconnect();
      backoff = 0;
      hasConnected = false;
      Object.assign(this, getDefaults());
    },

    /**
     * Re-open a stream that stalled waiting for reauth (see `_scheduleReconnect`). No-ops unless a
     * workspace stream is stalled with a now-valid token, so it can't create a duplicate or
     * unauthenticated connection - e.g. when reauth is cancelled via logout and the token cleared.
     */
    resumeIfStalled() {
      const auth = useAuthStore();
      if (this.workspaceId && !client && !closing && auth.accessToken && !auth.isTokenExpired) {
        this._open();
      }
    },

    _open() {
      const auth = useAuthStore();
      const workspaceId = this.workspaceId;
      if (!workspaceId) {
        return;
      }
      this.status = 'connecting';
      client = openWorkspaceConnection({
        workspaceId,
        token: auth.accessToken,
        onOpen: () => this._onOpen(),
        onError: () => this._onError(),
        onEvent: (event) => this._handleEvent(event),
      });
    },

    _onOpen() {
      backoff = 0;
      this.status = 'open';
      if (hasConnected) {
        // Reconnected after a drop - reconcile anything missed while offline. Runs on the bus
        // queue so it stays ahead of live events that arrive during reconciliation.
        enqueue(() => this.resync());
      }
      hasConnected = true;
    },

    _onError() {
      // Manage reconnection ourselves (backoff + token refresh), so close the source first.
      closeClient();
      if (closing) {
        return;
      }
      this.status = 'reconnecting';
      this._scheduleReconnect();
    },

    _scheduleReconnect() {
      clearReconnectTimer();
      backoff = backoff ? Math.min(backoff * 2, RECONNECT_MAX_MS) : RECONNECT_MIN_MS;
      reconnectTimer = setTimeout(() => {
        if (closing) {
          return;
        }
        const auth = useAuthStore();
        if (!auth.accessToken || auth.isTokenExpired) {
          auth.setPendingReauth();
          return;
        }
        this._open();
      }, backoff);
    },

    /**
     * Full reconciliation on reconnect: reload the tree, re-sync open files, then announce it via
     * a single `realtime.resynced` event (no per-file event storm). Cheaper than server-side
     * event replay and always converges.
     */
    async resync() {
      const files = useFilesStore();
      const editor = useEditorStore();
      try {
        await files.loadFiles('/', true);
        await Promise.all(editor.opened.map((file) => editor.sync(file.path)));
        emit(EVENTS.REALTIME_RESYNCED, { workspaceId: this.workspaceId });
      } catch (error) {
        useNotificationsStore().error('Failed to resync workspace: ' + error.message);
      }
    },

    /**
     * Forward a WebSocket event onto the central event bus. The bus serializes dispatches, so
     * events are applied in the order they arrive.
     */
    _handleEvent(event) {
      const auth = useAuthStore();
      // Echo suppression: ignore events caused by this user (e.g. the owner's own actions) -
      // the local action already emitted the equivalent event with `source: 'local'`.
      if (event.actor_user_id && event.actor_user_id === auth.userId) {
        return;
      }
      return emit(event.type, { ...event, source: 'remote' });
    },
  },
});
