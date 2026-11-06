import { defineStore } from 'pinia';

import { EVENTS, emit, enqueue, workspaceSession } from '@/services/events';
import { openUserConnection, openWorkspaceConnection } from '@/services/collab.service';
import { CLIENT_ID } from '@/utils/client-id';
import { useAuthStore } from './auth';
import { useEditorStore } from './editor';
import { useNotificationsStore } from './notifications';
import { useWorkspacesStore } from './workspaces';

const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30000;

// Close codes the server sends on purpose (documented in ceos-ard-server/openapi.yaml).
const WS_CLOSE = Object.freeze({
  SESSION_EXPIRED: 4001, // re-login, then reconnect
  ACCESS_REVOKED: 4003, // stop
  RESYNC: 4009, // reconnect now and resync
  POLICY_VIOLATION: 1008, // we sent data: stop
});

const streams = new Set();
let wakeListening = false;

/**
 * Network back or tab visible again: the streams skip the rest of a pending backoff. Registered once
 * for the app's lifetime.
 */
function listenForWake() {
  if (wakeListening) {
    return;
  }
  wakeListening = true;
  const wake = () => {
    if (document.visibilityState !== 'hidden') {
      streams.forEach((stream) => stream.wake());
    }
  };
  window.addEventListener('online', wake);
  document.addEventListener('visibilitychange', wake);
}

/**
 * A realtime connection that reconnects after drops with a backoff, asks for a new login when the
 * session ends and stops when the server refuses it. Kept out of Pinia state, so the WebSocket and
 * timers aren't wrapped in a reactive proxy.
 */
class RealtimeStream {
  /**
   * @param {Object} options
   * @param {(target: string, handlers: Object) => {close: () => void}} options.open - see
   *   `@/services/collab.service`
   * @param {(event: Object) => void} options.onEvent
   * @param {(missed: boolean) => void} [options.onOpen] - `missed` after a drop or a failed first
   *   attempt, when events may have been missed
   * @param {(target: string) => void} [options.onEnd] - the server refused or ended the stream
   */
  constructor({ open, onEvent, onOpen, onEnd }) {
    this.options = { open, onEvent, onOpen, onEnd };
    this.target = null;
    this.client = null;
    this.reconnectTimer = null;
    this.backoff = 0;
    // Connections opened since start(), whether they succeeded or not
    this.attempts = 0;
  }

  /** Connect to `target`, unless already connected to it. */
  start(target) {
    if (this.client && this.target === target) {
      return;
    }
    this.stop();
    // Recorded before the session check in _open, so a stream stalled on an expired session still
    // knows what to resume after the login.
    this.target = target;
    streams.add(this);
    listenForWake();
    this._open();
  }

  stop() {
    this._clearReconnectTimer();
    this._closeClient();
    this.target = null;
    this.backoff = 0;
    this.attempts = 0;
    streams.delete(this);
  }

  /**
   * Re-open a stream that stalled waiting for reauth. No-ops otherwise, so it can't create a
   * duplicate or unauthenticated connection - e.g. when reauth is cancelled via logout.
   */
  resumeIfStalled() {
    const auth = useAuthStore();
    if (this.target && !this.client && auth.isAuthenticated && !auth.isSessionExpired) {
      this._open();
    }
  }

  wake() {
    if (this.reconnectTimer) {
      this.backoff = 0;
      this._reconnect();
    }
  }

  _open() {
    if (!this.target) {
      return;
    }
    const auth = useAuthStore();
    if (!auth.isAuthenticated || auth.isSessionExpired) {
      // Ask for a new login; App.vue calls resumeIfStalled() afterwards.
      auth.setPendingReauth();
      return;
    }
    this.attempts++;
    this.client = this.options.open(this.target, {
      clientId: CLIENT_ID,
      onOpen: () => this._onOpen(),
      onClose: (info) => this._onClose(info),
      onEvent: this.options.onEvent,
    });
  }

  _onOpen() {
    this.backoff = 0;
    this.options.onOpen?.(this.attempts > 1);
  }

  /**
   * Closed without us asking: the server's code says what to do; anything else is a transient
   * drop and gets a backoff.
   */
  _onClose({ code } = {}) {
    this._closeClient();
    if (!this.target) {
      return;
    }
    switch (code) {
      case WS_CLOSE.SESSION_EXPIRED:
        // Ask for a new login; App.vue calls resumeIfStalled() afterwards.
        useAuthStore().setPendingReauth();
        return;
      case WS_CLOSE.ACCESS_REVOKED:
      case WS_CLOSE.POLICY_VIOLATION: {
        const target = this.target;
        this.stop();
        this.options.onEnd?.(target);
        return;
      }
      case WS_CLOSE.RESYNC:
        // Reconnect now; the re-open resyncs.
        this.backoff = 0;
        this._open();
        return;
      default:
        this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    this._clearReconnectTimer();
    this.backoff = this.backoff ? Math.min(this.backoff * 2, RECONNECT_MAX_MS) : RECONNECT_MIN_MS;
    // 50-100% jitter so tabs dropped together don't reconnect in lockstep
    const delay = Math.round(this.backoff * (0.5 + Math.random() * 0.5));
    this.reconnectTimer = setTimeout(() => this._reconnect(), delay);
  }

  _reconnect() {
    this._clearReconnectTimer();
    if (this.target && !this.client) {
      this._open();
    }
  }

  _clearReconnectTimer() {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  _closeClient() {
    this.client?.close();
    this.client = null;
  }
}

// The open workspace's events, forwarded onto the central event bus (see `@/services/events`) with
// `source: 'remote'`. The store listeners registered in main.js apply them - the same handlers that
// react to local operations.
const workspaceStream = new RealtimeStream({
  open: (workspaceId, handlers) => openWorkspaceConnection({ workspaceId, ...handlers }),
  // The server already filters this tab's own changes; the user's other tabs count as remote.
  onEvent: (event) => emit(event.type, { ...event, source: 'remote' }),
  // Runs on the bus queue so it stays ahead of live events that arrive during reconciliation
  onOpen: (missed) => missed && enqueue(() => useRealtimeStore().resync()),
  // A terminal event already left the workspace and never gets here; a rejected handshake has no
  // event, so announce the loss here.
  onEnd: (workspaceId) => {
    useRealtimeStore().workspaceId = null;
    emit(EVENTS.REALTIME_ACCESS_LOST, { workspaceId });
  },
});

// The changes to the user's list of workspaces. Not on the event bus: its listeners are about the
// open workspace, and these events can be about any other.
const userStream = new RealtimeStream({
  open: (userId, handlers) => openUserConnection(handlers),
  onEvent: (event) => useWorkspacesStore().applyListEvent(event),
  // Also on the first open: the list may have loaded before the stream was subscribed
  onOpen: () => useWorkspacesStore().refreshWorkspaces(),
});

export const useRealtimeStore = defineStore('realtime', {
  // Null while no workspace stream is wanted
  state: () => ({ workspaceId: null }),

  actions: {
    /** Open the stream of a workspace. Safe to call repeatedly. */
    connect(workspaceId) {
      this.workspaceId = workspaceId;
      workspaceStream.start(workspaceId);
    },

    disconnect() {
      workspaceStream.stop();
      this.workspaceId = null;
    },

    reset() {
      this.disconnect();
    },

    /** The user's stream, open while logged in; null closes it. */
    connectUser(userId) {
      useWorkspacesStore().resetListEvents();
      if (userId) {
        userStream.start(userId);
      } else {
        userStream.stop();
      }
    },

    resumeIfStalled() {
      workspaceStream.resumeIfStalled();
      userStream.resumeIfStalled();
    },

    /**
     * Full reconciliation on reconnect: reload the workspace (status, PFS selection), its PFS
     * options, the tree and the open files (unsaved edits are kept), then announce it via a single
     * `realtime.resynced` event (no per-file event storm). Cheaper than server-side event replay
     * and always converges.
     */
    async resync() {
      const workspaceId = this.workspaceId;
      const started = workspaceSession();
      const workspaces = useWorkspacesStore();
      const steps = [
        () => workspaces.refreshCurrentWorkspace(),
        () => workspaces.fetchPfs(workspaceId),
        () =>
          useEditorStore().refreshAfterRemoteUpdate({
            source: 'the changes made while disconnected',
          }),
      ];
      try {
        for (const step of steps) {
          await step();
          if (started !== workspaceSession()) {
            return; // Left or switched workspaces meanwhile
          }
        }
        emit(EVENTS.REALTIME_RESYNCED, { workspaceId });
      } catch (error) {
        if (started === workspaceSession()) {
          useNotificationsStore().error('Failed to resync workspace: ' + error.message);
        }
      }
    },
  },
});
