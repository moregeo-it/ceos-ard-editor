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

// Connection internals are kept in module scope (not Pinia state) so the non-serializable
// EventSource client and timers are never wrapped in a reactive proxy.
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
 * Applies the owner's live changes (received over SSE) to the read-only viewer's local stores.
 *
 * Phase 1: reuses the existing editor/preview handlers rather than re-issuing the mutation.
 * It calls the low-level files-store mutators (`updateFile`/`deleteFileFromStore`) - which do NOT
 * trip the local `filesEditorSyncPlugin`/`filesPreviewSyncPlugin` - then replicates their editor
 * and preview follow-up explicitly.
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
      this.status = 'idle';
      this.workspaceId = null;
    },

    reset() {
      this.disconnect();
      backoff = 0;
      hasConnected = false;
      Object.assign(this, getDefaults());
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
        onEvent: (event) => this._handleEvent(event),
      });
    },

    _onOpen() {
      backoff = 0;
      this.status = 'open';
      if (hasConnected) {
        // Reconnected after a drop - reconcile anything missed while offline.
        this.resync();
      }
      hasConnected = true;
    },

    _onError() {
      // We manage reconnection ourselves (for backoff + token refresh) instead of relying on
      // EventSource's built-in retry, so close the current source first.
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
     * Full reconciliation used on (re)connect: reload the file tree, re-sync open files, and
     * regenerate the preview. Cheaper than server-side event replay and always converges.
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
            preview.generatePreview();
            break;
          }

          case 'file.created': {
            if (event.file) files.updateFile(event.file);
            preview.generatePreview();
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
            preview.generatePreview();
            break;
          }

          case 'file.renamed': {
            files.deleteFileFromStore(event.path);
            if (event.file) files.updateFile(event.file);
            if (event.file && event.file.path) {
              await editor.onFileRenamed(event.path, event.file);
              if (event.file.path.startsWith('/pfs/')) {
                const workspaceId = workspaces.currentWorkspace?.id;
                if (workspaceId) workspaces.fetchPfs(workspaceId);
              }
            }
            preview.generatePreview();
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
            preview.generatePreview();
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
