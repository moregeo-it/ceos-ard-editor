import { defineStore } from 'pinia';
import workspaceService from '@/services/workspace.service';

export const useWorkspacesStore = defineStore('workspaces', {
  state: () => ({
    pfsOptions: [],
    workspacePfsOptions: [],
    // List of all workspaces
    workspaces: [],
    isLoading: false,
    // A single workspace being viewed/edited
    currentWorkspace: null,
    isCreating: false,
    isWorkspaceLoading: {},
  }),

  getters: {
    isArchived: (state) => {
      return state.currentWorkspace?.status === 'archived' || false;
    },

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
      } finally {
        this.isLoading = false;
      }
    },

    async createWorkspace(workspaceData) {
      this.isCreating = true;

      try {
        const newWorkspace = await workspaceService.createWorkspace(workspaceData);
        this.workspaces.unshift(newWorkspace);

        return newWorkspace;
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

        return updatedWorkspace;
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

        return updatedWorkspace;
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
      } finally {
        this.isWorkspaceLoading[workspaceId] = false;
      }
    },

    async fetchPfs() {
      this.pfsOptions = await workspaceService.fetchPfs();
    },

    async fetchWorkspacePfs(workspaceId) {
      this.workspacePfsOptions = await workspaceService.fetchWorkspacePfs(workspaceId);
    },

    async getWorkspace(workspaceId) {
      this.isWorkspaceLoading[workspaceId] = true;

      try {
        this.currentWorkspace = await workspaceService.getWorkspace(workspaceId);
        return this.currentWorkspace;
      } finally {
        this.isWorkspaceLoading[workspaceId] = false;
      }
    },
  },
});
