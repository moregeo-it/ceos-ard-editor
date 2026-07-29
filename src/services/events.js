/**
 * Central client-side event bus.
 *
 * Event names and payloads mirror the server's realtime WebSocket envelope — see
 * `ceos-ard-server/openapi.yaml` (WorkspaceEvent / WorkspaceEventType) and
 * `ceos-ard-server/app/schemas/events.py`. Those three places must be updated together.
 *
 * Client-only additions that never appear on the wire:
 * - `source: 'local' | 'remote'` on every event — `'local'` (the default) for events emitted by
 *   this client's own store actions, `'remote'` for events forwarded from the WebSocket by the
 *   realtime store (the only place that sets it). It is not for deduplication (echo suppression
 *   happens in the realtime store before the bus); it discriminates behavior where local and
 *   remote genuinely differ, e.g. remote events still need to be applied to the files store,
 *   while local events already mutated it inside the emitting action.
 * - The `realtime.*` namespace (e.g. `realtime.resynced`).
 *
 * Usage:
 * - Stores subscribe in an exported `register*EventListeners()` function colocated with the
 *   store, called once from main.js. These subscriptions live for the app's lifetime.
 * - Components use the EventListenerMixin (`this.onEvent(pattern, handler)`), which
 *   unsubscribes automatically on unmount. (This module deliberately has no Vue/Pinia imports
 *   so it stays usable anywhere, including Node scripts.)
 * - Only user-initiated store actions emit; low-level mutators never do (loop prevention).
 * - Handlers must be SELF-CONTAINED: depend only on the event payload and the handler's own
 *   store, never on the effects of other listeners. Handler execution order within one event is
 *   unspecified (events themselves are applied strictly in emit order). If a handler needs data,
 *   it belongs in the event payload - events carry complete snapshots for exactly this reason.
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
 *   local events omit it (the actor is always the current user). Echo suppression happens in the
 *   realtime store before the bus, so handlers never need to check it.
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
 * @property {number} [seq] Present iff the event was published by the server broker.
 * @property {string} [target_user_id] `share.revoked` only.
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
  WORKSPACE_ARCHIVED: 'workspace.archived',
  WORKSPACE_DELETED: 'workspace.deleted',
  // Client-only events — never sent over the wire.
  REALTIME_RESYNCED: 'realtime.resynced',
});

const handlers = new Map(); // pattern -> Set<handler>

// Serializes all dispatches: one event is fully handled before the next starts. This extends the
// ordering guarantee the realtime store previously kept for WebSocket events to local events too.
let queue = Promise.resolve();

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
  queue = queue.then(task).catch(() => {});
  return queue;
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
