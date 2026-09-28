import { defineStore } from 'pinia';
import previewService from '@/services/preview.service';

import { useWorkspacesStore } from './workspaces';
import { useNotificationsStore } from './notifications';

import { EVENTS, on } from '@/services/events';

// A refresh requested while one is running; a queued build wins over queued fetches
let queued = null; // 'build' | 'fetch' | null

const getDefaults = () => ({
  previewHtml: '',
  // Increments on every regeneration, even when the HTML is unchanged
  // (e.g. only an asset was deleted). Watch this instead of previewHtml.
  previewGeneration: 0,
  isGenerating: false,
  scrollPosition: [0, 0], // x, y
});

export const usePreviewStore = defineStore('preview', {
  state: () => getDefaults(),

  getters: {
    hasPreview: (state) => !!state.previewHtml,
    // The workspace's PFS list is the preview selection: the owner saves it, everyone follows it
    hasSelectedPfs: () => (useWorkspacesStore().currentWorkspace?.pfs?.length ?? 0) > 0,
  },

  actions: {
    setScrollPosition(x = 0, y = 0) {
      this.scrollPosition = [x, y];
    },

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
      const workspace = workspacesStore.currentWorkspace;

      if (!workspace?.id) {
        notifications.error('No workspace selected');
        return;
      }

      const shouldBuild = build && workspacesStore.isOwner;
      this.isGenerating = true;
      try {
        this.setPreviewHtml(
          shouldBuild
            ? await previewService.generatePreview(workspace.id, workspace.pfs)
            : await previewService.fetchCurrentPreview(workspace.id),
        );
      } catch (error) {
        // No build for this list yet: the owner's next build arrives as preview.generated
        if (error.status !== 404 || shouldBuild) {
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
     * once or twice instead of N times).
     * @param {{fetchOnly?: boolean}} [options] fetch the owner's last build instead of building
     */
    async requestPreviewRefresh({ fetchOnly = false } = {}) {
      if (this.isGenerating) {
        queued = queued === 'build' || !fetchOnly ? 'build' : 'fetch';
        return;
      }
      let build = !fetchOnly;
      do {
        queued = null;
        await this.generatePreview({ build });
        build = queued === 'build';
      } while (queued);
    },

    reset() {
      queued = null;
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
