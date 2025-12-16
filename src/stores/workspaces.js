import { defineStore } from 'pinia'
import workspaceService from '@/services/workspace.service'

export const useWorkspacesStore = defineStore('workspaces', {
  state: () => ({
    workspaces: [],
    currentWorkspace: null,
    pfsOptions: [],
    isLoading: false,
    isCreating: false,
    error: null,
  }),

  getters: {
    activeWorkspaces: (state) => {
      return state.workspaces.filter((w) => w.status === 'active')
    },

    archivedWorkspaces: (state) => {
      return state.workspaces.filter((w) => w.status === 'archived')
    },

    getWorkspaceById: (state) => (id) => {
      return state.workspaces.find((w) => w.id === id)
    },
  },

  actions: {
    async fetchWorkspaces() {
      this.isLoading = true
      this.error = null

      try {
        this.workspaces = await workspaceService.fetchWorkspaces()
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.isLoading = false
      }
    },

    async createWorkspace(workspaceData) {
      this.isCreating = true
      this.error = null

      try {
        const newWorkspace = await workspaceService.createWorkspace(workspaceData)
        this.workspaces.unshift(newWorkspace)
        return newWorkspace
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.isCreating = false
      }
    },

    async archiveWorkspace(workspaceId) {
      try {
        await workspaceService.archiveWorkspace(workspaceId)

        // Update local state
        const workspace = this.workspaces.find((w) => w.id === workspaceId)
        if (workspace) {
          workspace.status = 'archived'
        }
      } catch (error) {
        this.error = error.message
        throw error
      }
    },

    async fetchPfs() {
      try {
        this.pfsOptions = await workspaceService.fetchPfs()
      } catch (error) {
        console.error('Failed to fetch PFS options:', error)
        // Non-critical, don't throw
      }
    },

    async getWorkspace(workspaceId) {
      try {
        const workspace = await workspaceService.getWorkspace(workspaceId)
        console.log('🔧 Store: getWorkspace fetched:', workspace)
        this.currentWorkspace = workspace
        return workspace
      } catch (error) {
        this.error = error.message
        throw error
      }
    },
  },
})
