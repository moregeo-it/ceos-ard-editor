import { defineStore } from 'pinia';
import router from '@/router';

import { useEditorStore } from './editor';
import { useFilesStore } from './files';
import { useNotificationsStore } from './notifications';
import { usePreviewStore } from './preview';
import { useRealtimeStore } from './realtime';

import { EVENTS, on } from '@/services/events';
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

    // "owner" | "readonly" | undefined (not yet loaded)
    viewerRole: (state) => {
      return state.currentWorkspace?.viewer_role;
    },

    isOwner: (state) => {
      return state.currentWorkspace?.viewer_role === 'owner';
    },

    // True for readonly collaborators, or for anyone browsing an archived workspace
    // (mirrors the pre-existing archived-browsing behavior owners already relied on).
    isReadOnly() {
      if (!this.viewerRole) return false;
      return this.viewerRole === 'readonly' || this.isArchived;
    },

    activeWorkspaces: (state) => {
      return state.workspaces.filter((w) => w.status === 'active' && w.viewer_role === 'owner');
    },

    archivedWorkspaces: (state) => {
      return state.workspaces.filter((w) => w.status === 'archived' && w.viewer_role === 'owner');
    },

    sharedWorkspaces: (state) => {
      return state.workspaces.filter((w) => w.viewer_role && w.viewer_role !== 'owner');
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

    async fetchPfs(workspaceId) {
      const pfs = await workspaceService.fetchPfs(workspaceId);
      if (workspaceId) {
        this.workspacePfsOptions = pfs;
      } else {
        this.pfsOptions = pfs;
      }
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

// Events after which the PFS options may have changed (a save doesn't add/remove PFS folders).
const PFS_AFFECTING_EVENTS = new Set([
  EVENTS.FILE_CREATED,
  EVENTS.FILE_RENAMED,
  EVENTS.FILE_DELETED,
  EVENTS.FILE_REVERTED,
]);

function affectsPfs(event) {
  const paths = [event.path, event.old_path, event.file?.path];
  return paths.some((path) => typeof path === 'string' && path.startsWith('/pfs/'));
}

let listenersRegistered = false;

/**
 * React to workspace events: refresh the PFS options when files under /pfs/ change, reload the
 * workspace when it is archived, and leave the workspace when access is lost.
 */
export function registerWorkspacesEventListeners() {
  if (listenersRegistered) {
    return;
  }
  listenersRegistered = true;

  on('file.*', async (event) => {
    if (!PFS_AFFECTING_EVENTS.has(event.type) || !affectsPfs(event)) {
      return;
    }
    const workspaces = useWorkspacesStore();
    const workspaceId = workspaces.currentWorkspace?.id;
    if (workspaceId) {
      await workspaces.fetchPfs(workspaceId);
    }
  });

  on(EVENTS.WORKSPACE_ARCHIVED, async () => {
    const workspaces = useWorkspacesStore();
    const workspaceId = workspaces.currentWorkspace?.id || useRealtimeStore().workspaceId;
    if (workspaceId) {
      await workspaces.getWorkspace(workspaceId);
    }
  });

  // Access is gone (terminal events - the server closes the socket after delivering them):
  // tear down the realtime stream, clear workspace-scoped state, and leave.
  const handleAccessLost = () => {
    useNotificationsStore().warning(
      'Your access to this workspace has changed. Returning to your workspaces.',
    );
    useRealtimeStore().disconnect();
    useEditorStore().reset();
    useFilesStore().reset();
    usePreviewStore().reset();
    router.push({ name: 'workspaces' }).catch(() => {});
  };
  on(EVENTS.SHARE_REVOKED, handleAccessLost);
  on(EVENTS.WORKSPACE_DELETED, handleAccessLost);
}
