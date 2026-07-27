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
      const requests = [];
      // After commit, we need to refresh the file tree to reflect any changes
      for (const path in this.all) {
        const data = this.all[path];
        if (data.status !== null) {
          // If file has a status, it means it was changed in the commit, so we need to reload its context
          requests.push(this.loadFileContext(path, true));
        }
      }
      return await Promise.all(requests);
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
        const entry = this.all[path];
        if (!entry) {
          continue;
        }
        if (change.status === 'deleted') {
          this.deleteFileFromStore(path);
        } else {
          entry.status = null;
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
     * Remove a folder and everything inside it from the store.
     *
     * `all` is a flat path->file map and the tree is derived from those paths, so removing only the
     * folder's own entry would leave its descendants (paths under `${folderPath}/`) behind. Delete
     * the folder entry and every descendant entry.
     */
    deleteFolderFromStore(folderPath) {
      const prefix = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
      for (const path of Object.keys(this.all)) {
        if (path === folderPath || path.startsWith(prefix)) {
          delete this.all[path];
        }
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
      // Snapshot the entry before deleting: an untracked delete responds with no body (204), so
      // the subtree handling and the event payload need the entry we still hold.
      const existing = this.all[filePath];
      const fileData = await fileService.deleteFile(getWorkspaceId(), filePath);
      const tracked = !!(fileData && fileData.path);
      if (existing?.is_directory || fileData?.is_directory) {
        this.deleteFolderFromStore(filePath);
      } else if (tracked) {
        this.updateFile(fileData);
      } else {
        this.deleteFileFromStore(filePath);
      }
      emit(EVENTS.FILE_DELETED, {
        path: filePath,
        file: tracked ? fileData : (existing ?? null),
        tracked,
      });
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
      emit(EVENTS.FILE_SAVED, { path: fileData.path, file: fileData });
    },

    /**
     * Revert file to last saved state
     */
    async revertFile(filePath) {
      const fileData = await fileService.revertFile(getWorkspaceId(), filePath);
      if (filePath !== fileData.path) {
        this.deleteFileFromStore(filePath);
      }
      this.updateFile(fileData);
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
 */
export function registerFilesEventListeners() {
  if (listenersRegistered) {
    return;
  }
  listenersRegistered = true;

  on(EVENTS.FILE_SAVED, (event) => {
    if (event.source === 'remote' && event.file) {
      useFilesStore().updateFile(event.file);
    }
  });

  on(EVENTS.FILE_CREATED, (event) => {
    if (event.source === 'remote' && event.file) {
      useFilesStore().updateFile(event.file);
    }
  });

  on(EVENTS.FILE_DELETED, (event) => {
    if (event.source !== 'remote') {
      return;
    }
    const files = useFilesStore();
    if (event.file?.is_directory) {
      // A folder delete is one event with no per-file events for its contents, so mirror it by
      // removing the whole subtree locally.
      files.deleteFolderFromStore(event.path);
    } else if (event.tracked && event.file?.path) {
      files.updateFile(event.file); // tracked delete keeps a "deleted" status in the tree
    } else {
      files.deleteFileFromStore(event.path);
    }
  });

  on(EVENTS.FILE_RENAMED, (event) => {
    if (event.source !== 'remote') {
      return;
    }
    const files = useFilesStore();
    files.deleteFileFromStore(event.old_path ?? event.path);
    if (event.file) {
      files.updateFile(event.file);
    }
  });

  on(EVENTS.FILE_REVERTED, (event) => {
    if (event.source !== 'remote') {
      return;
    }
    const files = useFilesStore();
    const oldPath = event.old_path ?? event.path;
    if (event.file && event.file.path !== oldPath) {
      files.deleteFileFromStore(oldPath);
    }
    if (event.file) {
      files.updateFile(event.file);
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
