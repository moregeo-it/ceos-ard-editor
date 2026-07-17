import { defineStore } from 'pinia';
import router from '@/router';

import { openWorkspaceEvents } from '@/services/events.service';
import { useAuthStore } from './auth';
import { useEditorStore } from './editor';
import { useFilesStore } from './files';
import { useNotificationsStore } from './notifications';
import { usePreviewStore } from './preview';
import { useWorkspacesStore } from './workspaces';

const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30000;

// Kept in module scope (not Pinia state) so the non-serializable EventSource + timers aren't
// wrapped in a reactive proxy.
let client = null;
let reconnectTimer = null;
let backoff = 0;
let closing = false;
let hasConnected = false; // true once the first open succeeds, so a re-open triggers a resync
// Promise chain that serializes event handling, so events are applied in order
let eventQueue = Promise.resolve();

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
 * Applies the owner's live SSE changes to a read-only viewer's local stores. Uses the low-level
 * files mutators (`updateFile`/`deleteFileFromStore`), which bypass the local sync plugins, then
 * replicates their editor/preview follow-up explicitly.
 */
export const useRealtimeStore = defineStore('realtime', {
  state: () => getDefaults(),

  actions: {
    /**
     * Open (or re-open) the SSE stream for a workspace. Safe to call repeatedly.
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
      eventQueue = Promise.resolve();
      this.status = 'idle';
      this.workspaceId = null;
    },

    reset() {
      this.disconnect();
      backoff = 0;
      hasConnected = false;
      eventQueue = Promise.resolve();
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
      client = openWorkspaceEvents({
        workspaceId,
        token: auth.accessToken,
        onOpen: () => this._onOpen(),
        onError: () => this._onError(),
        onEvent: (event) => this._enqueue(() => this._handleEvent(event)),
      });
    },

    /**
     * Append a task to the serialized event queue; it runs only after the previous task settles.
     */
    _enqueue(task) {
      eventQueue = eventQueue.then(task).catch(() => {});
      return eventQueue;
    },

    _onOpen() {
      backoff = 0;
      this.status = 'open';
      if (hasConnected) {
        // Reconnected after a drop - reconcile anything missed while offline. Enqueued so it runs
        // ahead of live events that arrive during reconciliation, instead of racing them.
        this._enqueue(() => this.resync());
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
     * Full reconciliation on reconnect: reload the tree, re-sync open files, regenerate preview.
     * Cheaper than server-side event replay and always converges.
     */
    async resync() {
      const files = useFilesStore();
      const editor = useEditorStore();
      const preview = usePreviewStore();
      try {
        await files.loadFiles('/', true);
        await Promise.all(editor.opened.map((file) => editor.sync(file.path)));
        preview.generatePreview();
      } catch (error) {
        useNotificationsStore().error('Failed to resync workspace: ' + error.message);
      }
    },

    async _handleEvent(event) {
      const auth = useAuthStore();
      // Echo suppression: ignore events caused by this user (e.g. the owner's own actions).
      if (event.actor_user_id && event.actor_user_id === auth.userId) {
        return;
      }

      const files = useFilesStore();
      const editor = useEditorStore();
      const preview = usePreviewStore();
      const workspaces = useWorkspacesStore();

      try {
        switch (event.type) {
          case 'file.saved': {
            if (event.file) files.updateFile(event.file);
            await editor.sync(event.path); // no-op if the file isn't open
            await preview.generatePreview();
            break;
          }

          case 'file.created': {
            if (event.file) files.updateFile(event.file);
            await preview.generatePreview();
            // Deliberately do NOT open a tab - viewers shouldn't get tabs opened by the owner.
            break;
          }

          case 'file.deleted': {
            if (event.file && event.file.path) {
              files.updateFile(event.file); // tracked delete keeps a "deleted" status in the tree
            } else {
              files.deleteFileFromStore(event.path);
            }
            await editor.onFileDeleted(event.path);
            await preview.generatePreview();
            break;
          }

          case 'file.renamed': {
            files.deleteFileFromStore(event.path);
            if (event.file) files.updateFile(event.file);
            if (event.file && event.file.path) {
              await editor.onFileRenamed(event.path, event.file);
              if (event.file.path.startsWith('/pfs/')) {
                const workspaceId = workspaces.currentWorkspace?.id;
                if (workspaceId) await workspaces.fetchPfs(workspaceId);
              }
            }
            await preview.generatePreview();
            break;
          }

          case 'file.reverted': {
            if (event.file && event.file.path !== event.path) {
              files.deleteFileFromStore(event.path);
            }
            if (event.file) files.updateFile(event.file);
            if (event.file && event.file.path) {
              await editor.onFileReverted(event.path, event.file);
            }
            await preview.generatePreview();
            break;
          }

          case 'file.committed': {
            await files.updateFilesAfterCommit();
            break;
          }

          case 'workspace.archived': {
            const workspaceId = workspaces.currentWorkspace?.id || this.workspaceId;
            if (workspaceId) await workspaces.getWorkspace(workspaceId);
            break;
          }

          case 'share.revoked':
          case 'workspace.deleted': {
            this._handleAccessLost();
            break;
          }
        }
      } catch (error) {
        useNotificationsStore().error('Failed to apply live update: ' + error.message);
      }
    },

    _handleAccessLost() {
      useNotificationsStore().warning(
        'Your access to this workspace has changed. Returning to your workspaces.',
      );
      this.disconnect();
      // Clear workspace-scoped state so the editor doesn't linger with stale data.
      useEditorStore().reset();
      useFilesStore().reset();
      usePreviewStore().reset();
      router.push({ name: 'workspaces' }).catch(() => {});
    },
  },
});
