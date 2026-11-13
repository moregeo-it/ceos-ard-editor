import { defineStore } from 'pinia';

import { useWorkspacesStore } from './workspaces';

import { EVENTS, on, workspaceSession } from '@/services/events';
import commentService from '@/services/comment.service';

const getDefaults = () => ({
  // The threads of the current workspace, newest first
  threads: [],
  isLoading: false,
  loaded: false,
  // The last load failed; shown while nothing was loaded
  loadFailed: false,
  // Unsent replies by thread id, kept while their thread isn't shown
  drafts: {},
  // The side pane shows the files or the comments; `path` limits the comments to a file or folder
  pane: 'files',
  path: null,
});

const getWorkspaceId = () => useWorkspacesStore().currentWorkspace?.id;

// Reloads and live updates overlap, and responses can arrive late: keep what changed meanwhile.
let latestLoad = 0;
let revision = 0;
const changedAt = new Map(); // thread id -> revision of its last local change
const deleted = new Set();

// `outdated` changes with the files, not `updated_at`: reloads take equal versions, upserts don't
const isNewer = (thread, than) => !than || thread.updated_at >= than.updated_at;
const isNewerVersion = (thread, than) => thread.updated_at > than.updated_at;

function touch(threadId) {
  changedAt.set(threadId, ++revision);
}

/** Whether `path` is `base` itself or lies in the folder `base`. */
export const isWithin = (path, base) => path === base || path.startsWith(`${base}/`);

export const useCommentsStore = defineStore('comments', {
  state: () => getDefaults(),

  getters: {
    /** The threads the comments pane shows. */
    shownThreads: (state) =>
      state.path
        ? state.threads.filter((thread) => isWithin(thread.path, state.path))
        : state.threads,

    openThreads: (state) =>
      state.threads.filter((thread) => thread.status === 'open' && !thread.outdated),

    /** The open threads the comments list shows, also those of missing files. */
    openThreadCount: (state) => state.threads.filter((thread) => thread.status === 'open').length,

    /** The number of open threads on a file, or on the files in a folder. */
    openCount() {
      return (path) => this.openThreads.filter((thread) => isWithin(thread.path, path)).length;
    },
  },

  actions: {
    /** (Re)load the threads of the current workspace. */
    async load() {
      const workspaceId = getWorkspaceId();
      if (!workspaceId) {
        return;
      }
      const started = workspaceSession();
      const load = ++latestLoad;
      const since = revision;
      this.isLoading = true;
      try {
        const threads = await commentService.listThreads(workspaceId);
        if (started === workspaceSession() && load === latestLoad) {
          this.threads = this.merge(threads, since);
          this.loaded = true;
          this.loadFailed = false;
        }
      } catch (error) {
        if (started === workspaceSession() && load === latestLoad) {
          this.loadFailed = true;
        }
        throw error;
      } finally {
        if (started === workspaceSession() && load === latestLoad) {
          this.isLoading = false;
        }
      }
    },

    /** Reload without waiting: the list shows when it fails. */
    reload() {
      this.load().catch((error) => console.error('Failed to reload the comments:', error));
    },

    setDraft(threadId, body) {
      if (body) {
        this.drafts[threadId] = body;
      } else {
        delete this.drafts[threadId];
      }
    },

    /** A loaded list, keeping the threads that changed here since revision `since`. */
    merge(loaded, since) {
      const changed = (id) => (changedAt.get(id) ?? 0) > since;
      const local = new Map(this.threads.map((thread) => [thread.id, thread]));
      const merged = loaded
        .filter((thread) => !deleted.has(thread.id))
        .map((thread) => {
          const mine = local.get(thread.id);
          return changed(thread.id) && mine && !isNewer(thread, mine) ? mine : thread;
        });
      const added = this.threads.filter(
        (thread) => changed(thread.id) && !merged.some((other) => other.id === thread.id),
      );
      return [...added, ...merged];
    },

    showFiles() {
      this.pane = 'files';
    },

    /** Switch the side pane to the comments, of one file or folder, or of the whole workspace. */
    showComments(path = null) {
      this.pane = 'comments';
      this.path = path;
    },

    /** Add a thread, or replace it with a newer version. */
    upsert(thread) {
      if (deleted.has(thread.id)) {
        return;
      }
      const index = this.threads.findIndex((existing) => existing.id === thread.id);
      if (index === -1) {
        this.threads.unshift(thread);
      } else if (isNewerVersion(thread, this.threads[index])) {
        this.threads[index] = thread;
      } else {
        return;
      }
      touch(thread.id);
    },

    remove(threadId) {
      deleted.add(threadId);
      touch(threadId);
      this.threads = this.threads.filter((thread) => thread.id !== threadId);
      delete this.drafts[threadId];
    },

    /** The file filter follows a renamed file or folder. */
    movePath(oldPath, newPath) {
      if (this.path && oldPath && newPath && isWithin(this.path, oldPath)) {
        this.path = newPath + this.path.slice(oldPath.length);
      }
    },

    /** Run a request that answers with a thread (or null when it was deleted) and apply it. */
    async apply(threadId, request, workspaceId = getWorkspaceId()) {
      const started = workspaceSession();
      const thread = await request(workspaceId);
      if (started !== workspaceSession()) {
        return thread;
      }
      if (thread) {
        this.upsert(thread);
      } else {
        this.remove(threadId);
      }
      return thread;
    },

    async createThread(path, body, workspaceId = getWorkspaceId()) {
      return this.apply(
        null,
        (workspaceId) => commentService.createThread(workspaceId, path, body),
        workspaceId,
      );
    },

    async setStatus(thread, status) {
      return this.apply(thread.id, (workspaceId) =>
        commentService.setThreadStatus(workspaceId, thread.id, status),
      );
    },

    async reply(thread, body) {
      return this.apply(thread.id, (workspaceId) =>
        commentService.addComment(workspaceId, thread.id, body),
      );
    },

    async editComment(thread, comment, body) {
      return this.apply(thread.id, (workspaceId) =>
        commentService.editComment(workspaceId, thread.id, comment.id, body),
      );
    },

    async deleteComment(thread, comment) {
      return this.apply(thread.id, (workspaceId) =>
        commentService.deleteComment(workspaceId, thread.id, comment.id),
      );
    },

    reset() {
      latestLoad++;
      changedAt.clear();
      deleted.clear();
      Object.assign(this, getDefaults());
    },
  },
});

// Events that can move a file, or make it disappear or come back: the server moves the threads
// along and computes `outdated`, so the threads are reloaded.
const FILE_EXISTENCE_EVENTS = [
  EVENTS.FILE_CREATED,
  EVENTS.FILE_DELETED,
  EVENTS.FILE_RENAMED,
  EVENTS.FILE_REVERTED,
  EVENTS.WORKSPACE_SYNCED,
  EVENTS.REALTIME_RESYNCED,
];

let listenersRegistered = false;

/** Apply other people's comment changes, and follow files that move or disappear. */
export function registerCommentsEventListeners() {
  if (listenersRegistered) {
    return;
  }
  listenersRegistered = true;

  // Only remote: this tab applies its own changes from the responses
  on(EVENTS.THREAD_CREATED, (event) => useCommentsStore().upsert(event.thread));
  on(EVENTS.THREAD_UPDATED, (event) => useCommentsStore().upsert(event.thread));
  on(EVENTS.THREAD_DELETED, (event) => useCommentsStore().remove(event.thread_id));

  on(EVENTS.FILE_RENAMED, (event) => {
    useCommentsStore().movePath(event.old_path ?? event.path, event.file?.path);
  });
  on(EVENTS.FILE_REVERTED, (event) => {
    useCommentsStore().movePath(event.old_path, event.file?.path);
  });

  // Also retries a load that failed. Not awaited, so other updates don't wait for it
  for (const type of FILE_EXISTENCE_EVENTS) {
    on(type, () => useCommentsStore().reload());
  }

  // Saving a deleted file restores it
  on(EVENTS.FILE_SAVED, (event) => {
    const comments = useCommentsStore();
    if (comments.threads.some((thread) => thread.outdated && thread.path === event.path)) {
      comments.reload();
    }
  });
}
