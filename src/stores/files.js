import { defineStore } from 'pinia';
import fileService from '@/services/file.service';

export const useFilesStore = defineStore('files', {
  state: () => ({
    files: {},
    fileTree: [], // Hierarchical structure
    searchResults: [], // Search results
    searchQuery: '',
    isSearchLoading: false,
    isPathLoading: [],
    error: null,
  }),

  actions: {
    /**
     * Load files from server and build tree structure
     */
    async loadFileTree(workspaceId, path = '/', force = false) {
      if (Array.isArray(this.files[path]) && !force) {
        // Already loaded
        return;
      }
      this.isPathLoading.push(path);
      this.error = null;
      try {
        const files = await fileService.fetchFileTree(workspaceId, path);
        this.files[path] = this.convertToFileTree(files);
        if (path === '/') {
          this.fileTree = this.files[path];
        } else {
          const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
          const item = this.files[parentPath].find((f) => f.path === path);
          if (item) {
            item.children = this.files[path];
          }
        }
        this.searchResults = [];
        this.searchQuery = '';
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        const ix = this.isPathLoading.indexOf(path);
        if (ix !== -1) {
          this.isPathLoading.splice(ix, 1);
        }
      }
    },

    /**
     * Search files and folders
     */
    async searchFiles(workspaceId, query) {
      if (!query.trim()) {
        // If query is empty, reload full tree
        await this.loadFileTree(workspaceId);
        return;
      }

      this.isSearchLoading = true;
      this.error = null;
      try {
        this.searchQuery = query;
        const results = await fileService.searchFiles(workspaceId, query);
        this.searchResults = this.buildTree(results);
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.isSearchLoading = false;
      }
    },

    /**
     * Build hierarchical tree from flat file list
     */
    convertToFileTree(files) {
      return files.map((file) => {
        return {
          name: file.name,
          path: file.path,
          type: file.is_directory ? 'folder' : 'file',
          status: file.status,
          children: file.is_directory ? [] : undefined,
        };
      });
    },

    /**
     * Build hierarchical tree from flat file list
     */
    buildTree(files) {
      // Create a map to store all nodes
      const nodeMap = new Map();
      const rootNodes = [];

      // First pass: Create all nodes
      files.forEach((file) => {
        const node = {
          name: file.name,
          path: file.path,
          type: file.is_directory ? 'folder' : 'file',
          status: file.status,
          children: file.is_directory ? [] : undefined,
        };
        nodeMap.set(file.path, node);
      });

      // Second pass: Build hierarchy
      files.forEach((file) => {
        const node = nodeMap.get(file.path);
        const pathParts = file.path.split('/');

        if (pathParts.length === 1) {
          // Root level item
          rootNodes.push(node);
        } else {
          // Find parent
          const parentPath = pathParts.slice(0, -1).join('/');
          const parent = nodeMap.get(parentPath);

          if (parent && parent.children) {
            parent.children.push(node);
          } else {
            // If parent doesn't exist, add to root (fallback)
            rootNodes.push(node);
          }
        }
      });

      return rootNodes;
    },

    /**
     * Create new file or folder
     */
    async createFile(workspaceId, path, name, type) {
      try {
        await fileService.createFile(workspaceId, path, name, type);
        // force reload the file tree to include the new file/folder
        await this.loadFileTree(workspaceId, path, true);
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    /**
     * Rename file or folder
     */
    async renameFile(workspaceId, filePath, newName) {
      try {
        await fileService.renameFile(workspaceId, filePath, newName);
        const path = filePath.substring(0, filePath.lastIndexOf('/')) || '/';
        // force reload the parent directory to reflect the rename
        await this.loadFileTree(workspaceId, path, true);
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    /**
     * Delete file or folder
     */
    async deleteFile(workspaceId, filePath) {
      try {
        await fileService.deleteFile(workspaceId, filePath);
        // force reload the parent directory to reflect the deletion
        const path = filePath.substring(0, filePath.lastIndexOf('/')) || '/';
        await this.loadFileTree(workspaceId, path, true);
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    /**
     * Save file content (placeholder - needs editor integration)
     */
    async saveFile(workspaceId, filePath, content) {
      try {
        await fileService.saveFile(workspaceId, filePath, content);
        // Reload the file tree to get updated status
        await this.loadFileTree(workspaceId);
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    /**
     * Revert file to last saved state
     */
    async revertFile(workspaceId, filePath) {
      try {
        await fileService.revertFile(workspaceId, filePath);
        // Reload the file tree to get updated status
        const path = filePath.substring(0, filePath.lastIndexOf('/')) || '/';
        await this.loadFileTree(workspaceId, path, true);
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    /**
     * Clear all state
     */
    clearState() {
      this.files = {};
      this.fileTree = [];
      this.searchResults = [];
      this.searchQuery = '';
      this.error = null;
      this.isPathLoading = [];
      this.isSearchLoading = false;
    },
  },
});
