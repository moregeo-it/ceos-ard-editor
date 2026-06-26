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

const refreshPreviewOptions = () => {
  const workspaces = useWorkspacesStore();
  const workspaceId = workspaces.currentWorkspace?.id;

  if (workspaceId) {
    return workspaces.fetchWorkspacePfs(workspaceId);
  }
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
     * Create new file or folder
     */
    async createFile(path, name, type) {
      const fileData = await fileService.createFile(getWorkspaceId(), path, name, type);
      generatePreview();
      this.updateFile(fileData);
      return fileData;
    },

    /**
     * Create a new pfs folder and document with content of source pfs
     */
    async createNewPfs(name, sourcePfs) {
      const templatePath = `/pfs/${sourcePfs}/document.yaml`;
      const templateContent = await this.load(templatePath);

      const folderData = await fileService.createFile(getWorkspaceId(), '/pfs', name, 'folder');
      this.updateFile(folderData);

      const fileData = await fileService.createFile(
        getWorkspaceId(),
        `/pfs/${name}`,
        'document.yaml',
        'file',
      );
      this.updateFile(fileData);

      const savedFileData = await fileService.saveFile(
        getWorkspaceId(),
        `/pfs/${name}/document.yaml`,
        templateContent,
      );
      this.updateFile(savedFileData);

      refreshPreviewOptions();

      return savedFileData;
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
      if (filePath !== fileData.path) {
        this.deleteFileFromStore(filePath);
      }
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
