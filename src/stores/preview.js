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
  queuedBuild: false,
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
     * Show the same preview as the owner after the workspace's PFS list changed.
     */
    async followWorkspacePfs(pfs) {
      const next = pfs || [];
      const current = this.selectedPfs || [];
      if (next.length === current.length && next.every((id, i) => id === current[i])) {
        return;
      }
      this.setSelectedPfs([...next]);
      await this.requestPreviewRefresh({ fetchOnly: true });
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

    /**
     * Only the owner builds; everyone else, and the owner's other tabs on `preview.generated`,
     * fetches the owner's last build.
     * @param {{build?: boolean}} [options] `build: false` fetches even in an owner tab
     */
    async generatePreview({ build = true } = {}) {
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
        this.setPreviewHtml(
          build && workspacesStore.isOwner
            ? await previewService.generatePreview(workspaceId, this.selectedPfs)
            : await previewService.fetchCurrentPreview(workspaceId),
        );
      } catch (error) {
        // No build for this list yet: the owner's next build arrives as preview.generated
        if (error.status !== 404 || workspacesStore.isOwner) {
          notifications.error(`Failed to generate preview: ${error.message}`);
        }
        this.setPreviewHtml('');
      } finally {
        this.isGenerating = false;
      }
    },

    /**
     * Regenerate the preview, coalescing concurrent requests: while a generation is running,
     * further requests fold into a single follow-up run (e.g. saveAll of N files regenerates
     * once or twice instead of N times). A queued build wins over queued fetches.
     * @param {{fetchOnly?: boolean}} [options] fetch the owner's last build instead of building
     */
    async requestPreviewRefresh({ fetchOnly = false } = {}) {
      if (this.isGenerating) {
        this.refreshQueued = true;
        this.queuedBuild = this.queuedBuild || !fetchOnly;
        return;
      }
      let build = !fetchOnly;
      do {
        this.refreshQueued = false;
        this.queuedBuild = false;
        await this.generatePreview({ build });
        build = this.queuedBuild;
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
 * The owner's tab that changed a file rebuilds; everyone else refreshes from the owner's build
 * on `preview.generated`. Fire-and-forget on purpose: generation can be slow and must not block
 * the event queue; `requestPreviewRefresh` coalesces overlapping requests.
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
    if (event.source !== 'local' || !useWorkspacesStore().isOwner) {
      return; // The tab that made the change builds; its build ends in preview.generated
    }
    usePreviewStore().requestPreviewRefresh();
  });

  on(EVENTS.PREVIEW_GENERATED, () => {
    usePreviewStore().requestPreviewRefresh({ fetchOnly: true });
  });

  on(EVENTS.REALTIME_RESYNCED, () => {
    usePreviewStore().requestPreviewRefresh();
  });
}
