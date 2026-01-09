import { defineStore } from 'pinia';
import fileService from '@/services/file.service';

export const useFilesStore = defineStore('files', {
  state: () => ({
    files: [], // Flat list from API
    fileTree: [], // Hierarchical structure
    searchResults: [], // Search results
    searchQuery: '',
    isLoading: false,
    error: null,
  }),

  actions: {
    /**
     * Load files from server and build tree structure
     */
    async loadFileTree(workspaceId) {
      this.isLoading = true;
      this.error = null;
      try {
        this.files = await fileService.fetchFileTree(workspaceId);
        this.fileTree = this.buildTree(this.files);
        this.searchResults = [];
        this.searchQuery = '';
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.isLoading = false;
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

      this.isLoading = true;
      this.error = null;
      try {
        this.searchQuery = query;
        const results = await fileService.searchFiles(workspaceId, query);
        this.searchResults = this.buildTree(results);
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.isLoading = false;
      }
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
        // Reload the file tree
        await this.loadFileTree(workspaceId);
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
        // Reload the file tree
        await this.loadFileTree(workspaceId);
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
        // Reload the file tree
        await this.loadFileTree(workspaceId);
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
        await this.loadFileTree(workspaceId);
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    /**
     * Clear all state
     */
    clearState() {
      this.files = [];
      this.fileTree = [];
      this.searchResults = [];
      this.searchQuery = '';
      this.error = null;
    },
  },
});
