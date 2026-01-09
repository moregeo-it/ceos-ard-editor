import { defineStore } from 'pinia'
import workspaceService from '@/services/workspace.service'

export const useWorkspacesStore = defineStore('workspaces', {
  state: () => ({
    pfsOptions: [],
    error: null,
    // List of all workspaces
    workspaces: [],
    isLoading: false,
    // A single workspace being viewed/edited
    currentWorkspace: null,
    isCreating: false,
    isWorkspaceLoading: {},
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

    async updateWorkspace(workspaceId, workspaceData) {
      this.isWorkspaceLoading[workspaceId] = true
      this.error = null

      try {
        const updatedWorkspace = await workspaceService.updateWorkspace(workspaceId, workspaceData)

        // Update local state
        const index = this.workspaces.findIndex((w) => w.id === workspaceId)
        if (index !== -1) {
          this.workspaces[index] = updatedWorkspace
        }

        // Update currentWorkspace if it matches
        if (this.currentWorkspace?.id === workspaceId) {
          this.currentWorkspace = updatedWorkspace
        }

        return updatedWorkspace
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.isWorkspaceLoading[workspaceId] = false
      }
    },

    async toggleWorkspaceStatus(workspaceId) {
      this.isWorkspaceLoading[workspaceId] = true
      this.error = null

      try {
        const workspace = this.workspaces.find((w) => w.id === workspaceId)
        if (!workspace) {
          throw new Error('Workspace not found')
        }

        const newStatus = workspace.status === 'active' ? 'archived' : 'active'
        const updatedWorkspace = await workspaceService.toggleWorkspaceStatus(
          workspaceId,
          newStatus,
        )

        // Update local state
        const index = this.workspaces.findIndex((w) => w.id === workspaceId)
        if (index !== -1) {
          this.workspaces[index] = updatedWorkspace
        }

        // Update currentWorkspace if it matches
        if (this.currentWorkspace?.id === workspaceId) {
          this.currentWorkspace = updatedWorkspace
        }

        return updatedWorkspace
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.isWorkspaceLoading[workspaceId] = false
      }
    },

    async deleteWorkspace(workspaceId) {
      this.isWorkspaceLoading[workspaceId] = true
      this.error = null

      try {
        await workspaceService.deleteWorkspace(workspaceId)

        // Remove from local state
        this.workspaces = this.workspaces.filter((w) => w.id !== workspaceId)

        // Clear currentWorkspace if it matches
        if (this.currentWorkspace?.id === workspaceId) {
          this.currentWorkspace = null
        }
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.isWorkspaceLoading[workspaceId] = false
      }
    },

    async fetchPfs() {
      try {
        this.pfsOptions = await workspaceService.fetchPfs()
      } catch (error) {
        console.error('Failed to fetch PFS options:', error)
        this.error = error.message
        throw error
      }
    },

    async getWorkspace(workspaceId) {
      this.isWorkspaceLoading[workspaceId] = true
      this.error = null

      try {
        this.currentWorkspace = await workspaceService.getWorkspace(workspaceId)
        return this.currentWorkspace
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.isWorkspaceLoading[workspaceId] = false
      }
    },
  },
})
