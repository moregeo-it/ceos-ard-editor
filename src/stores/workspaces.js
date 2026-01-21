import { defineStore } from 'pinia';
import workspaceService from '@/services/workspace.service';
import { useNotificationsStore } from './notifications';

const notificationsStore = useNotificationsStore();

export const useWorkspacesStore = defineStore('workspaces', {
  state: () => ({
    pfsOptions: [],
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
      return state.workspaces.filter((w) => w.status === 'active');
    },

    archivedWorkspaces: (state) => {
      return state.workspaces.filter((w) => w.status === 'archived');
    },

    getWorkspaceById: (state) => (id) => {
      return state.workspaces.find((w) => w.id === id);
    },
  },

  actions: {
    async fetchWorkspaces() {
      this.isLoading = true;

      try {
        this.workspaces = await workspaceService.fetchWorkspaces();
      } catch (error) {
        notificationsStore.error(`Failed to load data: ${error.message}`);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async createWorkspace(workspaceData) {
      this.isCreating = true;

      try {
        const newWorkspace = await workspaceService.createWorkspace(workspaceData);
        this.workspaces.unshift(newWorkspace);

        notificationsStore.success('Workspace created successfully');
        return newWorkspace;
      } catch (error) {
        notificationsStore.error(`Failed to create workspace: ${error.message}`);
        throw error;
      } finally {
        this.isCreating = false;
      }
    },

    async updateWorkspace(workspaceId, workspaceData) {
      this.isWorkspaceLoading[workspaceId] = true;

      try {
        const updatedWorkspace = await workspaceService.updateWorkspace(workspaceId, workspaceData);

        // Update local state
        const index = this.workspaces.findIndex((w) => w.id === workspaceId);
        if (index !== -1) {
          this.workspaces[index] = updatedWorkspace;
        }

        // Update currentWorkspace if it matches
        if (this.currentWorkspace?.id === workspaceId) {
          this.currentWorkspace = updatedWorkspace;
        }

        notificationsStore.success('Workspace updated successfully');
        return updatedWorkspace;
      } catch (error) {
        notificationsStore.error(`Failed to update workspace: ${error.message}`);
        throw error;
      } finally {
        this.isWorkspaceLoading[workspaceId] = false;
      }
    },

    async toggleWorkspaceStatus(workspaceId) {
      this.isWorkspaceLoading[workspaceId] = true;

      try {
        const workspace = this.workspaces.find((w) => w.id === workspaceId);
        if (!workspace) {
          throw new Error('Workspace not found');
        }

        const newStatus = workspace.status === 'active' ? 'archived' : 'active';
        const updatedWorkspace = await workspaceService.toggleWorkspaceStatus(
          workspaceId,
          newStatus,
        );

        // Update local state
        const index = this.workspaces.findIndex((w) => w.id === workspaceId);
        if (index !== -1) {
          this.workspaces[index] = updatedWorkspace;
        }

        // Update currentWorkspace if it matches
        if (this.currentWorkspace?.id === workspaceId) {
          this.currentWorkspace = updatedWorkspace;
        }

        notificationsStore.success(
          `Workspace ${newStatus === 'active' ? 'activated' : 'archived'} successfully`,
        );
        return updatedWorkspace;
      } catch (error) {
        notificationsStore.error(`Failed to toggle workspace status: ${error.message}`);
        throw error;
      } finally {
        this.isWorkspaceLoading[workspaceId] = false;
      }
    },

    async deleteWorkspace(workspaceId) {
      this.isWorkspaceLoading[workspaceId] = true;

      try {
        await workspaceService.deleteWorkspace(workspaceId);

        // Remove from local state
        this.workspaces = this.workspaces.filter((w) => w.id !== workspaceId);

        // Clear currentWorkspace if it matches
        if (this.currentWorkspace?.id === workspaceId) {
          this.currentWorkspace = null;
        }
        notificationsStore.success('Workspace deleted successfully');
      } catch (error) {
        notificationsStore.error(`Failed to delete workspace: ${error.message}`);
        throw error;
      } finally {
        this.isWorkspaceLoading[workspaceId] = false;
      }
    },

    async fetchPfs() {
      try {
        this.pfsOptions = await workspaceService.fetchPfs();
      } catch (error) {
        notificationsStore.error(`Failed to load PFS options: ${error.message}`);
        throw error;
      }
    },

    async getWorkspace(workspaceId) {
      this.isWorkspaceLoading[workspaceId] = true;

      try {
        this.currentWorkspace = await workspaceService.getWorkspace(workspaceId);
        return this.currentWorkspace;
      } catch (error) {
        notificationsStore.error(`Failed to load workspace: ${error.message}`);
        throw error;
      } finally {
        this.isWorkspaceLoading[workspaceId] = false;
      }
    },
  },
});
