import { defineStore } from 'pinia';

import { EVENTS, emit, enqueue } from '@/services/events';
import { openWorkspaceConnection } from '@/services/collab.service';
import { CLIENT_ID } from '@/utils/client-id';
import { useAuthStore } from './auth';
import { useEditorStore } from './editor';
import { useNotificationsStore } from './notifications';

const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30000;

// Close codes the server sends on purpose (documented in ceos-ard-server/openapi.yaml).
const WS_CLOSE = Object.freeze({
  SESSION_EXPIRED: 4001, // re-login, then reconnect
  ACCESS_REVOKED: 4003, // stop
  RESYNC: 4009, // reconnect now and resync
  POLICY_VIOLATION: 1008, // we sent data: stop
});

// Kept in module scope (not Pinia state) so the non-serializable WebSocket + timers aren't
// wrapped in a reactive proxy.
let client = null;
let reconnectTimer = null;
let backoff = 0;
let hasConnected = false; // true once the first open succeeds, so a re-open triggers a resync
let wakeListening = false;

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

/**
 * Manages the realtime WebSocket stream and forwards its events onto the central event bus
 * (see `@/services/events`) with `source: 'remote'`. The store listeners registered in main.js
 * apply them - the same handlers that react to local operations.
 */
export const useRealtimeStore = defineStore('realtime', {
  // Null while no stream is wanted (disconnected); every reconnect path checks it
  state: () => ({ workspaceId: null }),

  actions: {
    /**
     * Open (or re-open) the realtime stream for a workspace. Safe to call repeatedly.
     */
    connect(workspaceId) {
      // Already connected to this workspace - nothing to do.
      if (client && this.workspaceId === workspaceId) {
        return;
      }

      // The target is recorded before the token check in _open, so a stream stalled on an expired
      // token still knows what to resume after the login.
      this.disconnect();
      hasConnected = false;
      this.workspaceId = workspaceId;
      this._listenForWake();
      this._open();
    },

    /**
     * Tear down the connection and stop any pending reconnect.
     */
    disconnect() {
      clearReconnectTimer();
      closeClient();
      this.workspaceId = null;
    },

    reset() {
      this.disconnect();
      backoff = 0;
      hasConnected = false;
    },

    /**
     * Re-open a stream that stalled waiting for reauth (see `_onClose` / `_reconnect`). No-ops
     * unless a workspace stream is stalled with a now-valid token, so it can't create a duplicate
     * or unauthenticated connection - e.g. when reauth is cancelled via logout and the token cleared.
     */
    resumeIfStalled() {
      const auth = useAuthStore();
      if (this.workspaceId && !client && auth.accessToken && !auth.isTokenExpired) {
        this._open();
      }
    },

    _open() {
      const workspaceId = this.workspaceId;
      if (!workspaceId) {
        return;
      }
      const auth = useAuthStore();
      if (!auth.accessToken || auth.isTokenExpired) {
        // Ask for a new login; App.vue calls resumeIfStalled() afterwards.
        auth.setPendingReauth();
        return;
      }
      client = openWorkspaceConnection({
        workspaceId,
        token: auth.accessToken,
        clientId: CLIENT_ID,
        onOpen: () => this._onOpen(),
        onClose: (info) => this._onClose(info),
        // The server already filters this tab's own changes; the user's other tabs count as remote.
        onEvent: (event) => emit(event.type, { ...event, source: 'remote' }),
      });
    },

    _onOpen() {
      backoff = 0;
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
      if (!this.workspaceId) {
        return;
      }
      switch (code) {
        case WS_CLOSE.SESSION_EXPIRED:
          // Ask for a new login; App.vue calls resumeIfStalled() afterwards.
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
          this._open();
          return;
        default:
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
      if (!this.workspaceId || client) {
        return;
      }
      this._open();
    },

    /**
     * Network back or tab visible again: skip the rest of a pending backoff. Registered once for
     * the app's lifetime; without a pending reconnect the handler does nothing.
     */
    _listenForWake() {
      if (wakeListening) {
        return;
      }
      wakeListening = true;
      const wake = () => {
        if (document.visibilityState === 'hidden' || !reconnectTimer) {
          return;
        }
        backoff = 0;
        this._reconnect();
      };
      window.addEventListener('online', wake);
      document.addEventListener('visibilitychange', wake);
    },

    /**
     * Full reconciliation on reconnect: reload the tree and the open files (unsaved edits are
     * kept), then announce it via a single `realtime.resynced` event (no per-file event storm).
     * Cheaper than server-side event replay and always converges.
     */
    async resync() {
      try {
        await useEditorStore().refreshAfterRemoteUpdate({
          source: 'the changes made while disconnected',
        });
        emit(EVENTS.REALTIME_RESYNCED, { workspaceId: this.workspaceId });
      } catch (error) {
        useNotificationsStore().error('Failed to resync workspace: ' + error.message);
      }
    },
  },
});
