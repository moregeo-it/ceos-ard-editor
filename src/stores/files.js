import { defineStore } from 'pinia';

import { useWorkspacesStore } from './workspaces';

import { EVENTS, emit, on } from '@/services/events';
import fileService from '@/services/file.service';

const getWorkspaceId = () => {
  const workspaces = useWorkspacesStore();
  return workspaces.currentWorkspace?.id;
};

const getDefaults = () => ({
  all: {},
  searchResults: null, // Search results
  isSearchLoading: false,
  isPathLoading: [],
  isFolderComplete: {},
  openedFolders: [],
  activatedItems: [],
  searchQuery: '',
});

const getParentPath = (filePath) => {
  if (filePath === '/') {
    return null;
  }
  return filePath.substring(0, filePath.lastIndexOf('/')) || '/';
};

const toFileTreeObject = (file) => {
  const obj = Object.assign({}, file);
  obj.type = file.is_directory ? 'folder' : 'file';
  obj.children = file.is_directory ? [] : null;
  if (file.type) {
    obj.resultType = file.type;
  }
  return obj;
};

export const useFilesStore = defineStore('files', {
  state: () => getDefaults(),

  getters: {
    folders(state) {
      const folders = {};
      for (const path in state.all) {
        const file = state.all[path];
        const parent = getParentPath(path);
        if (!folders[parent]) {
          folders[parent] = [];
        }
        folders[parent].push(toFileTreeObject(file));
      }
      for (const path in folders) {
        folders[path].sort((a, b) => {
          // Folders first, then files, both alphabetically
          if (a.type === b.type) {
            return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
          }
          return a.type === 'folder' ? -1 : 1;
        });
      }
      return folders;
    },
    /**
     * Get files/folders for current file tree view
     */
    fileTree() {
      const getTree = (path) => {
        const items = this.folders[path] || [];
        return items.map((item) => {
          if (item.type === 'folder') {
            item.children = getTree(item.path);
          }
          return item;
        });
      };
      return getTree('/');
    },
  },

  actions: {
    async loadFileContext(path, force = false) {
      // File context endpoint adds an additional usage property, which means if it's already
      // there, we have already loaded the context
      if (Array.isArray(this.all[path]) && typeof this.all[path].usage !== 'undefined' && !force) {
        return this.all[path]; // Already loaded
      }
      this.isPathLoading.push(path);
      try {
        const context = await fileService.loadFileContext(getWorkspaceId(), path);
        this.all[path] = context;
        return context;
      } finally {
        this.resetPathLoading(path);
      }
    },
    /**
     * Load files from server and build tree structure
     */
    async loadFiles(path = '/', force = false) {
      if (this.isFolderComplete[path] && !force) {
        return; // Already loaded
      }
      this.isPathLoading.push(path);
      try {
        const files = await fileService.fetchFileTree(getWorkspaceId(), path);
        files.forEach((file) => (this.all[file.path] = file));
        this.isFolderComplete[path] = true;
      } finally {
        this.resetPathLoading(path);
      }
    },

    async updateFilesAfterCommit() {
      // Refresh every file that had a pending status. Capture paths first — reloading clears them.
      const changedPaths = Object.keys(this.all).filter((path) => this.all[path].status !== null);
      const results = await Promise.all(
        changedPaths.map((path) => this.loadFileContext(path, true)),
      );
      // Mirror the cleared status into any matching search rows.
      changedPaths.forEach((path) => {
        if (this.all[path]) {
          this.syncSearchResultUpsert(path, this.all[path]);
        }
      });
      return results;
    },

    /**
     * Apply the change list of a `file.committed` event, avoiding the per-file refetch of
     * `updateFilesAfterCommit`: committed deletes drop their entry, everything else just loses
     * its pending status.
     */
    applyCommittedChanges(changes) {
      for (const change of changes) {
        // Change paths come from git and may lack the leading slash the store keys have.
        const path = change.path.startsWith('/') ? change.path : '/' + change.path;
        // Sync the row before the `!entry` guard: results can hold paths not loaded into `all`.
        if (change.status === 'deleted') {
          this.syncSearchResultDelete(path);
        }
        const entry = this.all[path];
        if (!entry) {
          continue;
        }
        if (change.status === 'deleted') {
          this.deleteFileFromStore(path);
        } else {
          entry.status = null;
          this.syncSearchResultUpsert(path, entry); // clear the row's now-committed status badge
        }
      }
    },

    resetPathLoading(path) {
      const ix = this.isPathLoading.indexOf(path);
      if (ix !== -1) {
        this.isPathLoading.splice(ix, 1);
      }
    },

    /**
     * Search files and folders
     */
    async searchFiles(query) {
      query = typeof query === 'string' ? query.trim() : '';
      if (query.length < 3) {
        // If query is empty, reload full tree
        await this.loadFiles();
        return;
      }

      this.isSearchLoading = true;
      try {
        const files = await fileService.searchFiles(getWorkspaceId(), query);
        this.searchResults = files.map(toFileTreeObject);
      } finally {
        this.isSearchLoading = false;
      }
    },

    updateFile(file) {
      this.all[file.path] = file;
    },

    deleteFileFromStore(filePath) {
      delete this.all[filePath];
    },

    /**
     * Drop a path (and its descendants, for a folder) from the active search results. No-op when
     * not searching.
     */
    syncSearchResultDelete(path) {
      if (!this.searchResults) {
        return;
      }
      const prefix = path.endsWith('/') ? path : `${path}/`;
      this.searchResults = this.searchResults.filter(
        (file) => file.path !== path && !file.path.startsWith(prefix),
      );
    },

    /**
     * Refresh a search-result row in place (rename/revert/save): find it by `oldPath`, take live
     * fields from `file`, keep the search-only ones (excerpt, line, column). No-op when not
     * searching or the row isn't shown. File-only — rename/revert never span folders (delete does,
     * via syncSearchResultDelete).
     */
    syncSearchResultUpsert(oldPath, file) {
      if (!this.searchResults || !file) {
        return;
      }
      const ix = this.searchResults.findIndex((result) => result.path === oldPath);
      if (ix === -1) {
        return;
      }
      // Snapshot fields overwrite; search-only fields survive. Index assignment is reactive in Vue 3.
      this.searchResults[ix] = { ...this.searchResults[ix], ...toFileTreeObject(file) };
    },

    /**
     * Restoring a file (save/revert) recreates its parent folders on the server; mirror that in the
     * tree. Walk up the chain, un-marking deleted folders and recreating ones pruned on delete (else
     * the file is orphaned), stopping at the first live ancestor.
     */
    syncAncestorFolders(filePath) {
      let parent = getParentPath(filePath);
      while (parent && parent !== '/') {
        const entry = this.all[parent];
        if (!entry) {
          // Recreate an ancestor pruned on delete.
          this.all[parent] = {
            name: parent.substring(parent.lastIndexOf('/') + 1),
            path: parent,
            is_directory: true,
            status: null,
          };
        } else if (entry.status === 'deleted') {
          this.all[parent] = { ...entry, status: null };
        } else {
          break;
        }
        parent = getParentPath(parent);
      }
    },

    /**
     * Drop a deleted folder's descendants and collapse it, so re-expanding it re-fetches its
     * now-deleted contents from the backend. Clearing isFolderComplete defeats loadFiles' cache;
     * collapsing (removing from openedFolders) lets the next expand fire folder-expand again.
     */
    deleteFolderDescendants(folderPath) {
      const prefix = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
      for (const path of Object.keys(this.all)) {
        if (path.startsWith(prefix)) {
          delete this.all[path];
        }
      }
      for (const path of Object.keys(this.isFolderComplete)) {
        if (path === folderPath || path.startsWith(prefix)) {
          delete this.isFolderComplete[path];
        }
      }
      this.openedFolders = this.openedFolders.filter(
        (path) => path !== folderPath && !path.startsWith(prefix),
      );
    },

    /**
     * Apply a folder deletion: prune the descendants (see deleteFolderDescendants), then keep the
     * folder marked "deleted" if tracked/revertible, or remove it if untracked. Shared by the local
     * action and the remote handler so owner and invitee converge.
     */
    deleteFolderFromStore(folderPath, { tracked = false, folderData = null } = {}) {
      this.deleteFolderDescendants(folderPath);
      if (tracked && folderData) {
        this.updateFile(folderData);
      } else {
        this.deleteFileFromStore(folderPath);
      }
    },

    /**
     * Create new file or folder
     */
    async createFile(path, name, type) {
      const fileData = await fileService.createFile(getWorkspaceId(), path, name, type);
      this.updateFile(fileData);
      emit(EVENTS.FILE_CREATED, { path: fileData.path, file: fileData });
      return fileData;
    },

    /**
     * Create a new pfs folder and document with content of source pfs
     */
    async createNewPfs(content) {
      const fileData = await fileService.createNewPFS(getWorkspaceId(), content);
      this.updateFile(fileData);
      emit(EVENTS.FILE_CREATED, { path: fileData.path, file: fileData });
      return fileData;
    },

    /**
     * Rename file or folder
     */
    async renameFile(filePath, newName) {
      const fileData = await fileService.renameFile(getWorkspaceId(), filePath, newName);
      this.deleteFileFromStore(filePath);
      this.updateFile(fileData);
      emit(EVENTS.FILE_RENAMED, { path: filePath, old_path: filePath, file: fileData });
      return fileData;
    },

    /**
     * Delete file or folder
     */
    async deleteFile(filePath) {
      // Snapshot before deleting: an untracked delete returns no body (204), so the subtree handling
      // and event payload need it. Fall back to search results, where a folder may not be in `all`.
      const existing =
        this.all[filePath] ?? this.searchResults?.find((file) => file.path === filePath) ?? null;
      const fileData = await fileService.deleteFile(getWorkspaceId(), filePath);
      const tracked = !!(fileData && fileData.path);
      const file = tracked ? fileData : existing;
      if (existing?.is_directory || fileData?.is_directory) {
        this.deleteFolderFromStore(filePath, { tracked, folderData: file });
      } else if (tracked) {
        this.updateFile(fileData);
      } else {
        this.deleteFileFromStore(filePath);
      }
      emit(EVENTS.FILE_DELETED, { path: filePath, file, tracked });
      return fileData;
    },

    async load(filePath) {
      return await fileService.loadFile(getWorkspaceId(), filePath);
    },

    /**
     * Save file content
     */
    async save(filePath, content) {
      const fileData = await fileService.saveFile(getWorkspaceId(), filePath, content);
      this.updateFile(fileData);
      this.syncAncestorFolders(filePath);
      emit(EVENTS.FILE_SAVED, { path: fileData.path, file: fileData });
    },

    /**
     * Revert file to last saved state
     */
    async revertFile(filePath) {
      // Only a deleted file's revert restores parent folders; check before the status is updated.
      const wasDeleted = this.all[filePath]?.status === 'deleted';
      const fileData = await fileService.revertFile(getWorkspaceId(), filePath);
      if (filePath !== fileData.path) {
        this.deleteFileFromStore(filePath);
      }
      this.updateFile(fileData);
      if (wasDeleted) {
        this.syncAncestorFolders(fileData.path);
      }
      emit(EVENTS.FILE_REVERTED, {
        path: filePath,
        old_path: filePath !== fileData.path ? filePath : undefined,
        file: fileData,
      });
      return fileData;
    },

    /**
     * Clear all state
     */
    reset() {
      Object.assign(this, getDefaults());
    },
  },
});

let listenersRegistered = false;

/**
 * Apply workspace events to the files store. Remote events (another user's changes forwarded from
 * the WebSocket) are applied through the low-level mutators; local events already mutated the
 * store inside the action that emitted them.
 *
 * Search results are a separate snapshot no action maintains, so each handler syncs them first,
 * above the `source` guard (i.e. for local and remote alike).
 */
export function registerFilesEventListeners() {
  if (listenersRegistered) {
    return;
  }
  listenersRegistered = true;

  on(EVENTS.FILE_SAVED, (event) => {
    const files = useFilesStore();
    // Refresh the row's status; excerpt is left as-is (may go stale) to avoid re-searching per save.
    files.syncSearchResultUpsert(event.file?.path, event.file);
    if (event.source === 'remote' && event.file) {
      files.updateFile(event.file);
      files.syncAncestorFolders(event.file.path);
    }
  });

  on(EVENTS.FILE_CREATED, (event) => {
    if (event.source === 'remote' && event.file) {
      useFilesStore().updateFile(event.file);
    }
  });

  on(EVENTS.FILE_DELETED, (event) => {
    const files = useFilesStore();
    files.syncSearchResultDelete(event.path); // drop the file (or folder subtree) from results
    if (event.source !== 'remote') {
      return;
    }
    if (event.file?.is_directory) {
      // A folder delete is one event with no per-file events for its contents, so mirror it by
      // removing the whole subtree locally.
      files.deleteFolderFromStore(event.path, { tracked: event.tracked, folderData: event.file });
    } else if (event.tracked && event.file?.path) {
      files.updateFile(event.file); // tracked delete keeps a "deleted" status in the tree
    } else {
      files.deleteFileFromStore(event.path);
    }
  });

  on(EVENTS.FILE_RENAMED, (event) => {
    const files = useFilesStore();
    files.syncSearchResultUpsert(event.old_path ?? event.path, event.file); // rename the row in place
    if (event.source !== 'remote') {
      return;
    }
    files.deleteFileFromStore(event.old_path ?? event.path);
    if (event.file) {
      files.updateFile(event.file);
    }
  });

  on(EVENTS.FILE_REVERTED, (event) => {
    const files = useFilesStore();
    const oldPath = event.old_path ?? event.path;
    files.syncSearchResultUpsert(oldPath, event.file); // restore the row to its reverted state
    if (event.source !== 'remote') {
      return;
    }
    if (event.file && event.file.path !== oldPath) {
      files.deleteFileFromStore(oldPath);
    }
    if (event.file) {
      files.updateFile(event.file);
      files.syncAncestorFolders(event.file.path);
    }
  });

  // Both sources: local commits emit without a change list until the server exposes one.
  on(EVENTS.FILE_COMMITTED, async (event) => {
    const files = useFilesStore();
    if (Array.isArray(event.changes) && event.changes.length > 0) {
      files.applyCommittedChanges(event.changes);
    } else {
      await files.updateFilesAfterCommit();
    }
  });
}
