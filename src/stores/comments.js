import { defineStore } from 'pinia';

import { useWorkspacesStore } from './workspaces';

import { EVENTS, on, workspaceSession } from '@/services/events';
import commentService from '@/services/comment.service';

const getDefaults = () => ({
  // The threads of the current workspace, newest first
  threads: [],
  isLoading: false,
  loaded: false,
  // The side pane shows the files or the comments; `path` limits the comments to a file or folder
  pane: 'files',
  path: null,
});

const getWorkspaceId = () => useWorkspacesStore().currentWorkspace?.id;

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
      this.isLoading = true;
      try {
        const threads = await commentService.listThreads(workspaceId);
        // A late answer must not land in a workspace opened meanwhile
        if (started === workspaceSession()) {
          this.threads = threads;
          this.loaded = true;
        }
      } finally {
        if (started === workspaceSession()) {
          this.isLoading = false;
        }
      }
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
      const index = this.threads.findIndex((existing) => existing.id === thread.id);
      if (index === -1) {
        this.threads.unshift(thread);
      } else {
        this.threads[index] = thread;
      }
    },

    remove(threadId) {
      this.threads = this.threads.filter((thread) => thread.id !== threadId);
    },

    /** Run a request that answers with a thread (or null when it was deleted) and apply it. */
    async apply(threadId, request) {
      const started = workspaceSession();
      const thread = await request(getWorkspaceId());
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

    async createThread(path, body) {
      return this.apply(null, (workspaceId) =>
        commentService.createThread(workspaceId, path, body),
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

  for (const type of FILE_EXISTENCE_EVENTS) {
    on(type, async () => {
      const comments = useCommentsStore();
      if (comments.loaded) {
        await comments.load();
      }
    });
  }
}
