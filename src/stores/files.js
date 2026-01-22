import { defineStore } from 'pinia';

import { usePreviewStore } from './preview';
import { useWorkspacesStore } from './workspaces';

import fileService from '@/services/file.service';

const getWorkspaceId = () => {
  const workspaces = useWorkspacesStore();
  return workspaces.currentWorkspace?.id;
};

const generatePreview = () => {
  const previewStore = usePreviewStore();
  // Trigger preview regeneration, but don't await it to avoid UI delays
  // and we also don't want to fail on preview errors here
  previewStore.generatePreview();
};

const getDefaults = () => ({
  all: {},
  searchResults: null, // Search results
  isSearchLoading: false,
  isPathLoading: [],
  isFolderComplete: {},
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
      if (!query.trim()) {
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
     * Create new file or folder
     */
    async createFile(path, name, type) {
      const fileData = await fileService.createFile(getWorkspaceId(), path, name, type);
      generatePreview();
      this.updateFile(fileData);
      return fileData;
    },

    /**
     * Rename file or folder
     */
    async renameFile(filePath, newName) {
      const fileData = await fileService.renameFile(getWorkspaceId(), filePath, newName);
      generatePreview();
      this.deleteFileFromStore(filePath);
      this.updateFile(fileData);
      return fileData;
    },

    /**
     * Delete file or folder
     */
    async deleteFile(filePath) {
      const fileData = await fileService.deleteFile(getWorkspaceId(), filePath);
      generatePreview();
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
      generatePreview();
      this.updateFile(fileData);
    },

    /**
     * Revert file to last saved state
     */
    async revertFile(filePath) {
      const fileData = await fileService.revertFile(getWorkspaceId(), filePath);
      generatePreview();
      this.deleteFileFromStore(filePath);
      this.updateFile(fileData);
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
