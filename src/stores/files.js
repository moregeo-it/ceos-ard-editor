import { defineStore } from 'pinia';

import { useWorkspacesStore } from './workspaces';

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
    /**
     * Whether a path is a folder. Falls back to search results, since a searched folder can
     * exist in searchResults but not yet in `all`.
     */
    isDirectory: (state) => (path) =>
      state.all[path]?.is_directory ??
      state.searchResults?.find((file) => file.path === path)?.is_directory ??
      false,
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
      if (this.searchResults) {
        this.searchResults = this.searchResults.filter(
          (file) => file.path !== folderPath && !file.path.startsWith(prefix),
        );
      }
    },

    /**
     * Create new file or folder
     */
    async createFile(path, name, type) {
      const fileData = await fileService.createFile(getWorkspaceId(), path, name, type);
      this.updateFile(fileData);
      return fileData;
    },

    /**
     * Create a new pfs folder and document with content of source pfs
     */
    async createNewPfs(content) {
      const fileData = await fileService.createNewPFS(getWorkspaceId(), content);

      this.updateFile(fileData);

      return fileData;
    },

    /**
     * Rename file or folder
     */
    async renameFile(filePath, newName) {
      const fileData = await fileService.renameFile(getWorkspaceId(), filePath, newName);
      this.deleteFileFromStore(filePath);
      this.updateFile(fileData);
      return fileData;
    },

    /**
     * Delete file or folder
     */
    async deleteFile(filePath) {
      const isDirectory = this.isDirectory(filePath);
      const fileData = await fileService.deleteFile(getWorkspaceId(), filePath);
      if (isDirectory || fileData?.is_directory) {
        this.deleteFolderDescendants(filePath);
      }
      if (fileData && fileData.path) {
        this.updateFile(fileData);
      } else {
        this.deleteFileFromStore(filePath);
      }
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
