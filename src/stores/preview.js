import { defineStore } from 'pinia';
import previewService from '@/services/preview.service';

import { useWorkspacesStore } from './workspaces';
import { useNotificationsStore } from './notifications';

import { EVENTS, on } from '@/services/events';

const getDefaults = () => ({
  selectedPfs: null,
  oldSelectedPfs: null,
  previewHtml: '',
  // Increments on every regeneration, even when the HTML is unchanged
  // (e.g. only an asset was deleted). Watch this instead of previewHtml.
  previewGeneration: 0,
  isGenerating: false,
  refreshQueued: false,
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
    setPreviewHtml(html) {
      this.previewHtml = html;
      this.previewGeneration++;
    },

    async generatePreview() {
      if (!this.hasSelectedPfs) {
        this.setPreviewHtml('');
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
        this.setPreviewHtml(await previewService.generatePreview(workspaceId, this.selectedPfs));
      } catch (error) {
        notifications.error(`Failed to generate preview: ${error.message}`);
        this.setPreviewHtml('');
      } finally {
        this.isGenerating = false;
      }
    },

    /**
     * Regenerate the preview, coalescing concurrent requests: while a generation is running,
     * further requests fold into a single follow-up run (e.g. saveAll of N files regenerates
     * once or twice instead of N times).
     */
    async requestPreviewRefresh() {
      if (this.isGenerating) {
        this.refreshQueued = true;
        return;
      }
      do {
        this.refreshQueued = false;
        await this.generatePreview();
      } while (this.refreshQueued);
    },

    /**
     * Reset the store to defaults
     */
    reset() {
      Object.assign(this, getDefaults());
    },
  },
});

let listenersRegistered = false;

/**
 * Regenerate the preview when files change (locally or remotely) and after a reconnect resync.
 * Fire-and-forget on purpose: generation can be slow and must not block the event queue;
 * `requestPreviewRefresh` coalesces overlapping requests.
 */
export function registerPreviewEventListeners() {
  if (listenersRegistered) {
    return;
  }
  listenersRegistered = true;

  on('file.*', (event) => {
    if (event.type === EVENTS.FILE_COMMITTED) {
      return; // Commits don't change file contents, so the preview is unaffected.
    }
    usePreviewStore().requestPreviewRefresh();
  });

  on(EVENTS.REALTIME_RESYNCED, () => {
    usePreviewStore().requestPreviewRefresh();
  });
}
