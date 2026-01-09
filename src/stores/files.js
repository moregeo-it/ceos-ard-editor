import { defineStore } from 'pinia'
import fileService from '@/services/file.service'

export const useFilesStore = defineStore('files', {
  state: () => ({
    files: [], // Flat list from API
    fileTree: [], // Hierarchical structure
    isLoading: false,
    error: null,
  }),

  actions: {
    /**
     * Load files from server and build tree structure
     */
    async loadFileTree(workspaceId) {
      this.isLoading = true
      this.error = null
      try {
        this.files = await fileService.fetchFileTree(workspaceId)
        this.fileTree = this.buildTree(this.files)
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Build hierarchical tree from flat file list
     */
    buildTree(files) {
      // Create a map to store all nodes
      const nodeMap = new Map()
      const rootNodes = []

      // First pass: Create all nodes
      files.forEach((file) => {
        const node = {
          name: file.name,
          path: file.path,
          type: file.is_directory ? 'folder' : 'file',
          status: file.status,
          children: file.is_directory ? [] : undefined,
        }
        nodeMap.set(file.path, node)
      })

      // Second pass: Build hierarchy
      files.forEach((file) => {
        const node = nodeMap.get(file.path)
        const pathParts = file.path.split('/')

        if (pathParts.length === 1) {
          // Root level item
          rootNodes.push(node)
        } else {
          // Find parent
          const parentPath = pathParts.slice(0, -1).join('/')
          const parent = nodeMap.get(parentPath)

          if (parent && parent.children) {
            parent.children.push(node)
          } else {
            // If parent doesn't exist, add to root (fallback)
            rootNodes.push(node)
          }
        }
      })

      return rootNodes
    },

    /**
     * Create new file or folder
     */
    async createFile(workspaceId, path, name, isDirectory) {
      try {
        await fileService.createFile(workspaceId, path, name, isDirectory)
        // Reload the file tree
        await this.loadFileTree(workspaceId)
      } catch (error) {
        this.error = error.message
        throw error
      }
    },

    /**
     * Clear all state
     */
    clearState() {
      this.files = []
      this.fileTree = []
      this.error = null
    },
  },
})
