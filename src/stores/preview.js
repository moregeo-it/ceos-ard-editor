import { defineStore } from 'pinia';
import previewService from '@/services/preview.service';

import { useWorkspacesStore } from './workspaces';
import { useNotificationsStore } from './notifications';

const getDefaults = () => ({
  selectedPfs: null,
  oldSelectedPfs: null,
  previewHtml: '',
  isGenerating: false,
  scrollPosition: [0, 0], // x, y
});

export const usePreviewStore = defineStore('preview', {
  state: () => getDefaults(),

  getters: {
    hasPreview: (state) => !!state.previewHtml,
    hasSelectedPfs: (state) => Array.isArray(state.selectedPfs) && state.selectedPfs.length > 0,
  },

  actions: {
    setScrollPosition(x = 0, y = 0) {
      this.scrollPosition = [x, y];
    },

    /**
     * Set the selected PFS
     * @param {Array} pfs - Array of PFS identifiers
     */
    setSelectedPfs(pfs) {
      this.selectedPfs = pfs;
    },

    /**
     * Store old selected PFS before selection change
     */
    storeOldSelection() {
      this.oldSelectedPfs = this.selectedPfs;
    },

    /**
     * Clear old selection reference
     */
    clearOldSelection() {
      this.oldSelectedPfs = null;
    },

    /**
     * Generate preview for the selected PFS
     * @returns {Promise<string>} The generated HTML
     */
    async generatePreview() {
      if (!this.hasSelectedPfs) {
        this.previewHtml = '';
        return;
      }

      const workspacesStore = useWorkspacesStore();
      const notifications = useNotificationsStore();
      const workspaceId = workspacesStore.currentWorkspace?.id;

      if (!workspaceId) {
        notifications.error('No workspace selected');
        return;
      }

      this.isGenerating = true;
      try {
        this.previewHtml = await previewService.generatePreview(workspaceId, this.selectedPfs);
      } catch (error) {
        notifications.error(`Failed to generate preview: ${error.message}`);
        this.previewHtml = '';
      } finally {
        this.isGenerating = false;
      }
    },

    /**
     * Reset the store to defaults
     */
    reset() {
      Object.assign(this, getDefaults());
    },
  },
});

export function filesPreviewSyncPlugin({ store }) {
  if (store.$id !== 'files') {
    return;
  }

  store.$onAction(({ name, args, after }) => {
    const preview = usePreviewStore();
    after(async () => {
      // Regenerate preview
      switch (name) {
        case 'createFile':
        case 'renameFile':
        case 'deleteFile':
        case 'save':
        case 'revertFile': {
          try {
            await preview.generatePreview();
          } catch (error) {
            useNotificationsStore().error(
              'Updating preview after file operation failed: ' + error.message,
            );
          }
          break;
        }
      }

      // Refresh preview options
      switch (name) {
        case 'createNewPfs':
        case 'renameFile':
        case 'deleteFile':
        case 'revertFile': {
          try {
            if (name !== 'createNewPfs') {
              const [filePath] = args;
              if (filePath && !filePath.startsWith('/pfs/')) {
                break; // Only refresh preview options if a pfs file was changed
              }
            }

            const workspaces = useWorkspacesStore();
            const workspaceId = workspaces.currentWorkspace?.id;
            if (workspaceId) {
              await workspaces.fetchPfs(workspaceId);
            }
          } catch (error) {
            useNotificationsStore().error(
              'Updating preview options after file operation failed: ' + error.message,
            );
          }
          break;
        }
      }
    });
  });
}
