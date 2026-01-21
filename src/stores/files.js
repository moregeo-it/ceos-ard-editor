import { defineStore } from 'pinia';

import { usePreviewStore } from './preview';
const previewStore = usePreviewStore();

import { useWorkspacesStore } from './workspaces';
const workspaces = useWorkspacesStore();

import { useNotificationsStore } from './notifications';
const notifications = useNotificationsStore();

import fileService from '@/services/file.service';

const getDefaults = () => ({
  all: {},
  searchResults: null, // Search results
  isSearchLoading: false,
  isPathLoading: [],
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
      try {
        this.isPathLoading.push(path);
        const context = await fileService.loadFileContext(workspaces.currentWorkspace.id, path);
        this.all[path] = context;
        return context;
      } catch (error) {
        notifications.error(`Failed to load file context: ${error.message}`);
        throw error;
      } finally {
        this.resetPathLoading(path);
      }
    },
    /**
     * Load files from server and build tree structure
     */
    async loadFiles(path = '/', force = false) {
      if (Array.isArray(this.folders[path]) && !force) {
        return; // Already loaded
      }
      const workspaceId = workspaces.currentWorkspace.id;
      this.isPathLoading.push(path);
      try {
        const files = await fileService.fetchFileTree(workspaceId, path);
        files.forEach((file) => (this.all[file.path] = file));
      } catch (error) {
        notifications.error(`Failed to load files: ${error.message}`);
        throw error;
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
      const workspaceId = workspaces.currentWorkspace.id;
      if (!query.trim()) {
        // If query is empty, reload full tree
        await this.loadFiles();
        return;
      }

      this.isSearchLoading = true;
      try {
        const files = await fileService.searchFiles(workspaceId, query);
        this.searchResults = files.map(toFileTreeObject);
      } catch (error) {
        notifications.error(`Failed to search files: ${error.message}`);
        throw error;
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
      const workspaceId = workspaces.currentWorkspace.id;
      try {
        const fileData = await fileService.createFile(workspaceId, path, name, type);
        // Trigger preview regeneration, but don't await it to avoid UI delays
        // and we also don't want to fail on preview errors here
        previewStore.generatePreview();
        this.updateFile(fileData);
        notifications.success(
          `${type.charAt(0).toUpperCase() + type.slice(1)} created successfully`,
        );
      } catch (error) {
        notifications.error(error.message);
        throw error;
      }
    },

    /**
     * Rename file or folder
     */
    async renameFile(filePath, newName) {
      const workspaceId = workspaces.currentWorkspace.id;
      try {
        const fileData = await fileService.renameFile(workspaceId, filePath, newName);
        // Trigger preview regeneration, but don't await it to avoid UI delays
        // and we also don't want to fail on preview errors here
        previewStore.generatePreview();
        this.deleteFileFromStore(filePath);
        this.updateFile(fileData);
        notifications.success('Renamed successfully');
      } catch (error) {
        notifications.error(error.message);
        throw error;
      }
    },

    /**
     * Delete file or folder
     */
    async deleteFile(filePath) {
      const workspaceId = workspaces.currentWorkspace.id;
      try {
        const fileData = await fileService.deleteFile(workspaceId, filePath);
        // Trigger preview regeneration, but don't await it to avoid UI delays
        // and we also don't want to fail on preview errors here
        previewStore.generatePreview();

        if (fileData && fileData.path) {
          this.updateFile(fileData);
          notifications.warning('A tracked file has been deleted, it could be reverted.');
        } else {
          this.deleteFileFromStore(filePath);
          notifications.warning(
            "An untracked file has been deleted permanently, it can't be restored.",
          );
        }
      } catch (error) {
        notifications.error(`Failed to delete file: ${error.message}`);
        throw error;
      }
    },

    async loadContext(filePath) {
      try {
        return await fileService.loadFile(workspaces.currentWorkspace.id, filePath);
      } catch (error) {
        notifications.error(`Failed to load file context: ${error.message}`);
        throw error;
      }
    },

    async load(filePath) {
      try {
        return await fileService.loadFile(workspaces.currentWorkspace.id, filePath);
      } catch (error) {
        notifications.error(`Failed to load file: ${error.message}`);
        throw error;
      }
    },

    /**
     * Save file content
     */
    async save(filePath, content) {
      const fileData = await fileService.saveFile(
        workspaces.currentWorkspace.id,
        filePath,
        content,
      );
      // Trigger preview regeneration, but don't await it to avoid UI delays
      // and we also don't want to fail on preview errors here
      previewStore.generatePreview();
      this.updateFile(fileData);
    },

    /**
     * Revert file to last saved state
     */
    async revertFile(filePath) {
      const workspaceId = workspaces.currentWorkspace.id;
      try {
        const fileData = await fileService.revertFile(workspaceId, filePath);
        // Trigger preview regeneration, but don't await it to avoid UI delays
        // and we also don't want to fail on preview errors here
        previewStore.generatePreview();
        this.deleteFileFromStore(filePath);
        this.updateFile(fileData);
        notifications.success('File reverted successfully');
      } catch (error) {
        notifications.error(`Failed to revert file: ${error.message}`);
        throw error;
      }
    },

    /**
     * Clear all state
     */
    reset() {
      Object.assign(this, getDefaults());
    },
  },
});
