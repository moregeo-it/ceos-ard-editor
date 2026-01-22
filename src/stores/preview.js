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
