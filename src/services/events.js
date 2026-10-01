/**
 * Central client-side event bus.
 *
 * Event names and payloads mirror the server's realtime WebSocket envelope (`WorkspaceEvent` in
 * `ceos-ard-server/openapi.yaml` and `app/schemas/events.py`); `npm run check:events` keeps the
 * three in sync. Client-only additions: `source` (`'local'` for this tab's own store actions,
 * `'remote'` for events forwarded from the WebSocket) and the `realtime.*` events.
 *
 * Stores subscribe in a `register*EventListeners()` called once from main.js. Only user-initiated
 * store actions emit. Handlers depend only on the event payload and their own store: their order
 * within one event is unspecified, so events carry complete snapshots. No Vue/Pinia imports here,
 * so the module also runs in Node scripts.
 *
 * @typedef {Object} FileItem
 * @property {string} name
 * @property {string} path Workspace-root-relative path, e.g. `/requirements/foo.yaml`.
 * @property {boolean} is_directory
 * @property {'added'|'modified'|'deleted'|'renamed'|null} status
 *
 * @typedef {Object} WorkspaceEvent
 * @property {string} type One of the `EVENTS` values.
 * @property {'local'|'remote'} source Client-only, stamped at dispatch. Defaults to 'local';
 *   only the realtime store overrides it when forwarding WebSocket events.
 * @property {string} ts ISO timestamp; server publish time for remote events.
 * @property {string|null} [actor_user_id] Who caused the change. Only present on remote events;
 *   local events omit it. The server filters this tab's own changes, so the current user as actor
 *   means one of their other tabs or devices.
 * @property {string|null} [path] Affected path. On `file.renamed`/`file.reverted` this is the
 *   pre-change path (legacy semantics); prefer `old_path` where present.
 * @property {FileItem|null} [file] Snapshot of the affected file/folder after the operation.
 * @property {string} [old_path] Pre-change path on `file.renamed` and on `file.reverted` when the
 *   revert undid a staged rename.
 * @property {boolean} [tracked] `file.deleted` only: whether the delete is tracked in git and
 *   therefore revertible.
 * @property {{sha: string, message: string, timestamp: string, author: string}} [commit]
 *   `file.committed` only.
 * @property {Array<{path: string, status: string, source?: string}>} [changes]
 *   `file.committed` only: the changes included in the commit.
 * @property {'updated'|'merged'} [status] `workspace.synced` only: whether the workspace was
 *   fast-forwarded or merged with the changes from GitHub. Files may have changed at any depth.
 * @property {Array<'title'|'description'|'pfs'|'status'>} [fields] `workspace.updated` only: the
 *   changed workspace fields; refetch the workspace.
 * @property {string[]} [pfs] `preview.generated` only: the PFS list the owner built the preview
 *   for; fetch the current preview instead of building.
 * @property {number} [seq] Present iff the event was published by the server broker.
 * @property {string} [target_user_id] `share.revoked` and `share.updated` only.
 * @property {string} [mode] `share.updated` only: this user's new share mode; refetch the workspace.
 */

export const EVENTS = Object.freeze({
  // Server events — must match WorkspaceEventType in ceos-ard-server/openapi.yaml.
  FILE_SAVED: 'file.saved',
  FILE_CREATED: 'file.created',
  FILE_DELETED: 'file.deleted',
  FILE_RENAMED: 'file.renamed',
  FILE_REVERTED: 'file.reverted',
  FILE_COMMITTED: 'file.committed',
  SHARE_REVOKED: 'share.revoked',
  SHARE_UPDATED: 'share.updated',
  WORKSPACE_ARCHIVED: 'workspace.archived',
  WORKSPACE_DELETED: 'workspace.deleted',
  WORKSPACE_SYNCED: 'workspace.synced',
  WORKSPACE_UPDATED: 'workspace.updated',
  PREVIEW_GENERATED: 'preview.generated',
  // Client-only events — never sent over the wire.
  REALTIME_RESYNCED: 'realtime.resynced',
  // The server refused or ended the stream (close 4003/1008) without a terminal event.
  REALTIME_ACCESS_LOST: 'realtime.access_lost',
});

const handlers = new Map(); // pattern -> Set<handler>

// Serializes all dispatches: one event is fully handled before the next starts, for WebSocket and
// local events alike.
let queue = Promise.resolve();
// Bumped by discardQueuedEvents(): dispatches queued before it are skipped
let epoch = 0;

let onError = (error, type) => console.error(`Event handler failed for ${type}:`, error);

/**
 * Set the global handler for errors thrown by event handlers (wired to the notifications store
 * in main.js). Handler errors never block other handlers or subsequent events.
 */
export function setEventErrorHandler(fn) {
  onError = fn;
}

function matches(pattern, type) {
  return (
    pattern === type ||
    pattern === '*' ||
    (pattern.endsWith('.*') && type.startsWith(pattern.slice(0, -1)))
  );
}

/**
 * Subscribe to events. `pattern` is an exact type (`EVENTS.FILE_SAVED`), a namespace (`'file.*'`),
 * or `'*'`. The handler receives the full event object and may be async; it is awaited before the
 * next handler runs. Returns an unsubscribe function.
 */
export function on(pattern, handler) {
  if (!handlers.has(pattern)) {
    handlers.set(pattern, new Set());
  }
  handlers.get(pattern).add(handler);
  return () => handlers.get(pattern)?.delete(handler);
}

/**
 * Run a task on the serialized dispatch queue, after all previously emitted events have settled.
 * Used by the realtime store so a reconnect resync stays ordered ahead of live events.
 */
export function enqueue(task) {
  const queuedIn = epoch;
  queue = queue.then(() => (queuedIn === epoch ? task() : undefined)).catch(() => {});
  return queue;
}

/**
 * Skip every dispatch still waiting in the queue. Called when a workspace is left or another one
 * is opened, so events of the old workspace never reach the next one's freshly reset stores. A
 * handler already running is not interrupted; the stores discard its late writes themselves.
 */
export function discardQueuedEvents() {
  epoch++;
}

/**
 * Emit an event. Handlers run sequentially (in registration order, but handlers must not rely on
 * that - see the self-containment rule above), after all previously emitted events have fully
 * settled. Returns a promise that settles once all handlers ran; emitters normally
 * fire-and-forget it. Never rejects — handler errors go to the error handler.
 *
 * Never `await emit()` from inside an event handler: the emitted event is queued behind the
 * currently dispatching one, so awaiting it deadlocks the queue. Un-awaited reentrant emits are
 * fine and run after the current event completes.
 *
 * `source` defaults to `'local'`; only the realtime store overrides it when forwarding
 * WebSocket events.
 *
 * @param {string} type One of the `EVENTS` values.
 * @param {Partial<WorkspaceEvent>} payload
 */
export function emit(type, payload = {}) {
  const event = { ts: new Date().toISOString(), source: 'local', ...payload, type };
  return enqueue(async () => {
    for (const [pattern, set] of handlers) {
      if (!matches(pattern, type)) {
        continue;
      }
      for (const handler of [...set]) {
        try {
          await handler(event);
        } catch (error) {
          onError(error, type);
        }
      }
    }
  });
}
