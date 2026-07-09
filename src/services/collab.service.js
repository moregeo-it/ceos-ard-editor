import { useAuthStore } from '@/stores/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function wsBaseUrl() {
  return API_BASE_URL.replace(/^http/, 'ws');
}

/**
 * A collaborative-editing session for a single file, speaking the JSON protocol of the FastAPI
 * authority (see app/services/collab_service.py) which mirrors CodeMirror's collab example:
 *
 *   server -> {type:"init",    doc, updates}   (once, on connect)
 *   client -> {type:"push",    version, updates}
 *   server -> {type:"updates", updates}        (accepted edits, to everyone)
 *   server -> {type:"resync"}                  (client is ahead of a reset authority)
 *
 * Updates are opaque JSON here ({clientID, changes}); (de)serialization of CodeMirror `ChangeSet`s
 * happens in the editor where the CodeMirror types live.
 */
class CollabSession {
  constructor(url) {
    this._url = url;
    this._ws = null;
    this._closed = false;
    this._initialized = false;
    this._reconnectDelay = 1000;
    // A stable id for this client's edits, used by @codemirror/collab to recognize its own updates.
    this.clientID = Math.random().toString(36).slice(2);
    this.initialDoc = '';
    this.initialUpdates = [];
    this._onUpdates = null;
    this._onResync = null;
    this._view = null;
    this.ready = new Promise((resolve) => {
      this._resolveReady = resolve;
    });
    this._connect();
  }

  _connect() {
    const ws = new WebSocket(this._url);
    this._ws = ws;
    ws.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.type === 'init') {
        this._reconnectDelay = 1000;
        if (!this._initialized) {
          this._initialized = true;
          this.initialDoc = message.doc ?? '';
          this.initialUpdates = message.updates ?? [];
          this._resolveReady(this);
        } else {
          // Reconnected: the authority's state may not line up with our local version, so the
          // safest thing is to reload the file from the fresh init.
          this._onResync?.();
        }
      } else if (message.type === 'updates') {
        this._onUpdates?.(message.updates ?? []);
      } else if (message.type === 'resync') {
        this._onResync?.();
      }
      // {type:"rejected"} needs no action: the authority also sends the missing updates as
      // {type:"updates"}, which triggers a rebase-and-repush.
    };
    ws.onclose = () => {
      if (this._closed) return;
      const delay = this._reconnectDelay;
      this._reconnectDelay = Math.min(delay * 2, 15000);
      setTimeout(() => {
        if (!this._closed) this._connect();
      }, delay);
    };
    ws.onerror = () => ws.close();
  }

  push(version, updates) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type: 'push', version, updates }));
    }
  }

  /**
   * Send the full document to the authority so it can durably persist it (write + git stage). The
   * authority owns persistence - this is what lets a reader who opens the file after everyone left
   * see the latest content instead of a stale on-disk copy.
   */
  sendSnapshot(doc) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type: 'snapshot', doc }));
    }
  }

  onUpdates(cb) {
    this._onUpdates = cb;
  }

  onResync(cb) {
    this._onResync = cb;
  }

  setView(view) {
    this._view = view;
  }

  getText() {
    return this._view ? this._view.state.doc.toString() : '';
  }

  disconnect() {
    // Flush a final snapshot so the authority persists the latest content on last-leave.
    if (this._ws && this._ws.readyState === WebSocket.OPEN && this._view) {
      this.sendSnapshot(this.getText());
    }
    this._closed = true;
    if (this._ws) this._ws.close();
  }
}

/**
 * Opens a collaborative session for `filePath` in `workspaceId`. Await `session.ready` for the
 * initial `{doc, updates}` before mounting the editor.
 */
export function connect(workspaceId, filePath) {
  const authStore = useAuthStore();
  const token = encodeURIComponent(authStore.accessToken ?? '');
  const url = `${wsBaseUrl()}/workspaces/${workspaceId}/collab/${encodeURIComponent(filePath)}?authorization=${token}`;
  return new CollabSession(url);
}

export function disconnect(session) {
  if (session) session.disconnect();
}
