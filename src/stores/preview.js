import { defineStore } from 'pinia';
import previewService from '@/services/preview.service';

import { useEditorStore } from './editor';
import { useNotificationsStore } from './notifications';
import { useTypesStore } from './types';
import { useWorkspacesStore } from './workspaces';

import { EVENTS, on, workspaceSession } from '@/services/events';

// A refresh requested while one is running; a queued build wins over queued fetches
let queued = null; // 'build' | 'fetch' | null
// This tab's running previews and downloads of the current workspace session, see track()
let running = { session: null, count: 0 };

const getDefaults = () => ({
  previewHtml: '',
  // Increments on every regeneration, even when the HTML is unchanged
  // (e.g. only an asset was deleted). Watch this instead of previewHtml.
  previewGeneration: 0,
  isGenerating: false,
  // The toolchain this tab's preview or download waits for, from `preview.preparing`; null when none
  preparing: null,
  scrollPosition: [0, 0], // x, y
  // The files the shown preview contains, with their number of places
  files: new Map(),
  // The last request to show a file in the preview: `{ path, index }` of the place
  showRequest: null,
  // The file shown by a workspace type that previews the open file, and why nothing is shown
  renderedPath: null,
  message: '',
});

export const usePreviewStore = defineStore('preview', {
  state: () => getDefaults(),

  getters: {
    hasPreview: (state) => !!state.previewHtml,
    // The owner saves the selection, e.g. PFS, and everyone follows it
    hasSelection: () => (useWorkspacesStore().currentWorkspace?.selection?.length ?? 0) > 0,
    // "build": the owner builds a document from the selection; "file": everyone renders the open file
    mode: () => useTypesStore().currentType?.preview ?? 'build',
  },

  actions: {
    setScrollPosition(x = 0, y = 0) {
      this.scrollPosition = [x, y];
    },

    setPreviewHtml(html) {
      this.previewHtml = html;
      this.previewGeneration++;
      // Known again once shown
      this.files = new Map();
    },

    setFiles(files) {
      this.files = files;
    },

    /**
     * Scroll the preview to a file, and open the preview if it is collapsed. Again for the same
     * file, to its next place.
     */
    showInPreview(path) {
      const last = this.showRequest;
      this.showRequest = { path, index: last?.path === path ? last.index + 1 : 0 };
    },

    /**
     * Run a preview or download request of this tab. `preview.preparing` reaches every tab, so it
     * only counts while such a request runs, and is forgotten once the last one ends.
     */
    async track(request) {
      const session = workspaceSession();
      if (running.session !== session) {
        running = { session, count: 0 };
      }
      if (running.count === 0) {
        this.preparing = null;
      }
      running.count++;
      try {
        return await request();
      } finally {
        if (running.session === session && --running.count === 0) {
          this.preparing = null;
        }
      }
    },

    /**
     * Only the owner builds; everyone else, and the owner's other tabs on `preview.generated`,
     * fetches the owner's last build.
     * @param {{build?: boolean}} [options] `build: false` fetches even in an owner tab
     */
    async generatePreview({ build = true } = {}) {
      if (this.mode === 'file') {
        await this.renderActiveFile();
        return;
      }
      if (!this.hasSelection) {
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
      const started = workspaceSession();
      this.isGenerating = true;
      try {
        const html = await this.track(() =>
          shouldBuild
            ? previewService.generatePreview(workspace.id)
            : previewService.fetchCurrentPreview(workspace.id),
        );
        if (started === workspaceSession()) {
          this.setPreviewHtml(html);
        }
      } catch (error) {
        if (started !== workspaceSession()) {
          return;
        }
        // No build for this list yet: the owner's next build arrives as preview.generated
        if (error.status !== 404 || shouldBuild) {
          notifications.error(`Failed to generate preview: ${error.message}`);
        }
        this.setPreviewHtml('');
      } finally {
        if (started === workspaceSession()) {
          this.isGenerating = false;
        }
      }
    },

    async renderActiveFile() {
      const workspace = useWorkspacesStore().currentWorkspace;
      const path = useEditorStore().active?.path ?? null;
      if (!workspace?.id || !path) {
        this.renderedPath = null;
        this.message = 'Open a file to see its preview.';
        this.setPreviewHtml('');
        return;
      }

      const started = workspaceSession();
      this.isGenerating = true;
      try {
        const html = await previewService.renderFile(workspace.id, path);
        if (started !== workspaceSession()) {
          return;
        }
        if (this.renderedPath !== path) {
          this.setScrollPosition(0, 0);
        }
        this.renderedPath = path;
        this.message = '';
        this.setPreviewHtml(html);
      } catch (error) {
        if (started !== workspaceSession()) {
          return;
        }
        this.renderedPath = path;
        this.message =
          error.status === 404
            ? 'There is no preview for this file.'
            : `Failed to render the preview: ${error.message}`;
        this.setPreviewHtml('');
      } finally {
        if (started === workspaceSession()) {
          this.isGenerating = false;
        }
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
      const started = workspaceSession();
      let build = !fetchOnly;
      do {
        queued = null;
        await this.generatePreview({ build });
        if (started !== workspaceSession()) {
          return; // Another workspace now; its queue is not this loop's to run
        }
        build = queued === 'build';
      } while (queued);
    },

    reset() {
      queued = null;
      running = { session: null, count: 0 };
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
    // Rendering the open file changes nothing on the server, so every viewer renders it
    if (usePreviewStore().mode === 'file') {
      usePreviewStore().requestPreviewRefresh();
      return;
    }
    if (event.source !== 'local' || !useWorkspacesStore().isOwner) {
      return; // The tab that made the change builds; its build ends in preview.generated
    }
    usePreviewStore().requestPreviewRefresh();
  });

  on(EVENTS.PREVIEW_GENERATED, () => {
    if (usePreviewStore().mode === 'file') {
      return;
    }
    usePreviewStore().requestPreviewRefresh({ fetchOnly: true });
  });

  // A build waits for an install; only for this tab if it waits too, see track()
  on(EVENTS.PREVIEW_PREPARING, (event) => {
    if (running.session === workspaceSession() && running.count > 0) {
      usePreviewStore().preparing = event.toolchain;
    }
  });

  on(EVENTS.REALTIME_RESYNCED, () => {
    usePreviewStore().requestPreviewRefresh();
  });

  // Files changed beyond single-file events; only the owner rebuilds a built preview
  on(EVENTS.WORKSPACE_SYNCED, () => {
    if (usePreviewStore().mode === 'file') {
      usePreviewStore().requestPreviewRefresh();
    }
  });
}
