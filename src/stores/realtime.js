import { defineStore } from 'pinia';

import { EVENTS, emit, enqueue } from '@/services/events';
import { openWorkspaceConnection } from '@/services/collab.service';
import { CLIENT_ID } from '@/services/client-id';
import { useAuthStore } from './auth';
import { useEditorStore } from './editor';
import { useFilesStore } from './files';
import { useNotificationsStore } from './notifications';

const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30000;

// Close codes the server sends on purpose (documented in ceos-ard-server/openapi.yaml).
export const WS_CLOSE = Object.freeze({
  SESSION_EXPIRED: 4001, // re-login, then reconnect
  ACCESS_REVOKED: 4003, // stop
  RESYNC: 4009, // reconnect now and resync
  POLICY_VIOLATION: 1008, // bad origin or we sent data: stop
});

// Kept in module scope (not Pinia state) so the non-serializable WebSocket + timers aren't
// wrapped in a reactive proxy.
let client = null;
let reconnectTimer = null;
let backoff = 0;
let closing = false;
let hasConnected = false; // true once the first open succeeds, so a re-open triggers a resync
let wakeHandler = null; // cuts a pending backoff short on 'online' / tab visible

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
      this._listenForWake();
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
      this._stopListeningForWake();
      backoff = 0;
      hasConnected = false;
      Object.assign(this, getDefaults());
    },

    /**
     * Re-open a stream that stalled waiting for reauth (see `_onClose` / `_reconnect`). No-ops
     * unless a workspace stream is stalled with a now-valid token, so it can't create a duplicate
     * or unauthenticated connection - e.g. when reauth is cancelled via logout and the token cleared.
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
        clientId: CLIENT_ID,
        onOpen: () => this._onOpen(),
        onClose: (info) => this._onClose(info),
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

    /**
     * Closed without us asking: the server's code says what to do; anything else is a transient
     * drop and gets a backoff.
     */
    _onClose({ code } = {}) {
      closeClient();
      if (closing) {
        return;
      }
      switch (code) {
        case WS_CLOSE.SESSION_EXPIRED:
          // Ask for a new login; App.vue calls resumeIfStalled() afterwards.
          this.status = 'reconnecting';
          useAuthStore().setPendingReauth();
          return;
        case WS_CLOSE.ACCESS_REVOKED:
        case WS_CLOSE.POLICY_VIOLATION: {
          // Terminal. A terminal event already ran disconnect() and never gets here; a rejected
          // handshake has no event, so announce the loss here.
          const workspaceId = this.workspaceId;
          this.disconnect();
          emit(EVENTS.REALTIME_ACCESS_LOST, { workspaceId });
          return;
        }
        case WS_CLOSE.RESYNC:
          // Reconnect now; the re-open resyncs.
          backoff = 0;
          this.status = 'reconnecting';
          this._open();
          return;
        default:
          this.status = 'reconnecting';
          this._scheduleReconnect();
      }
    },

    _scheduleReconnect() {
      clearReconnectTimer();
      backoff = backoff ? Math.min(backoff * 2, RECONNECT_MAX_MS) : RECONNECT_MIN_MS;
      // 50-100% jitter so tabs dropped together don't reconnect in lockstep
      const delay = Math.round(backoff * (0.5 + Math.random() * 0.5));
      reconnectTimer = setTimeout(() => this._reconnect(), delay);
    },

    _reconnect() {
      clearReconnectTimer();
      if (closing || client) {
        return;
      }
      const auth = useAuthStore();
      if (!auth.accessToken || auth.isTokenExpired) {
        auth.setPendingReauth();
        return;
      }
      this._open();
    },

    /**
     * Network back or tab visible again: skip the rest of a pending backoff.
     */
    _listenForWake() {
      if (wakeHandler) {
        return;
      }
      wakeHandler = () => {
        if (document.visibilityState === 'hidden' || !reconnectTimer || closing) {
          return;
        }
        backoff = 0;
        this._reconnect();
      };
      window.addEventListener('online', wakeHandler);
      document.addEventListener('visibilitychange', wakeHandler);
    },

    _stopListeningForWake() {
      if (!wakeHandler) {
        return;
      }
      window.removeEventListener('online', wakeHandler);
      document.removeEventListener('visibilitychange', wakeHandler);
      wakeHandler = null;
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
        // Refetches every loaded folder and drops entries that are gone, which a forced root
        // reload alone would leave behind
        await files.reloadTree();
        await Promise.all(editor.opened.map((file) => editor.sync(file.path)));
        emit(EVENTS.REALTIME_RESYNCED, { workspaceId: this.workspaceId });
      } catch (error) {
        useNotificationsStore().error('Failed to resync workspace: ' + error.message);
      }
    },

    /**
     * Forward a WebSocket event onto the central event bus, which applies events in arrival order.
     * The server already filters this tab's own changes; the user's other tabs count as remote.
     */
    _handleEvent(event) {
      return emit(event.type, { ...event, source: 'remote' });
    },
  },
});
