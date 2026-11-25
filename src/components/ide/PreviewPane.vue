<template>
  <div class="d-flex flex-column fill-height" :class="{ 'reading-mode': readingMode }">
    <div
      v-if="hasSelectionBar || previewStore.mode === 'file' || readingMode"
      class="pa-2 pt-3 d-flex align-center border-b-sm"
    >
      <template v-if="hasSelectionBar">
        <v-tooltip :text="selectionTooltip" location="bottom" max-width="320">
          <template #activator="{ props }">
            <v-icon
              v-bind="props"
              :icon="icons.info"
              tabindex="0"
              :aria-label="`About the ${selection.label} selection`"
              class="mr-2"
            />
          </template>
        </v-tooltip>
        <!-- Only the owner picks the selection, also in an archived workspace, as it changes no files -->
        <SelectionSelect
          :model-value="selectValue"
          :items="selectionOptions"
          :disabled="!workspacesStore.isOwner"
          :label="`Select ${selection.multiple ? '' : 'a '}${selection.label} for the preview`"
          :multiple="selection.multiple"
          :chips="selection.multiple"
          :no-data-text="`The workspace has no ${selection.label}`"
          hide-details
          class="preview-select flex-grow-1"
          @update:model-value="handleSelect"
          @update:menu="handleMenuToggle"
        />
        <v-menu v-if="downloads.length > 0" location="bottom end">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              color="primary"
              class="ml-2"
              :prepend-icon="icons.download"
              :disabled="!previewHtml"
              :loading="isAnyDownloading"
            >
              Download
            </v-btn>
          </template>
          <v-list density="compact">
            <v-list-item
              v-for="format in downloads"
              :key="format"
              :title="DOWNLOADS[format].label"
              @click="downloadPreview(format)"
            />
          </v-list>
        </v-menu>
      </template>
      <v-spacer v-else />
      <v-btn
        color="primary"
        min-width="0"
        class="ml-2 px-2"
        :disabled="!previewHtml && !readingMode"
        :title="readingMode ? 'Exit reading mode' : 'Reading mode'"
        :aria-label="readingMode ? 'Exit reading mode' : 'Reading mode'"
        :aria-pressed="readingMode"
        @click="toggleReadingMode"
      >
        <v-icon :icon="readingMode ? icons.exitReadingMode : icons.readingMode" />
      </v-btn>
    </div>

    <div class="flex-grow-1">
      <v-alert
        v-if="previewStore.preparing && !isGenerating && isAnyDownloading"
        type="info"
        variant="tonal"
        class="ma-4"
      >
        Setting up the tools for the download. This happens once and can take a few minutes.
      </v-alert>
      <div v-if="isGenerating" class="text-center pa-8 ma-4">
        <v-progress-circular indeterminate color="primary" size="64" />
        <p v-if="previewStore.preparing" class="mt-4 text-medium-emphasis">
          Setting up the tools for this workspace. This happens once and can take a few minutes.
        </p>
      </div>

      <v-alert v-else-if="!previewHtml" type="info" variant="tonal" class="ma-4">
        <template v-if="previewStore.mode === 'file'">{{ previewStore.message }}</template>
        <template v-else-if="!workspacesStore.isOwner"
          >The owner has not generated a preview yet.</template
        >
        <template v-else-if="!previewStore.hasSelection">
          Select {{ selection?.multiple ? 'at least one' : 'a' }} {{ selection?.label }} from the
          list above to create a preview.
        </template>
        <template v-else>No preview generated. Please try again.</template>
      </v-alert>

      <!-- Preview Document -->
      <div v-show="!isGenerating && previewHtml" class="fill-height">
        <iframe
          ref="iframe"
          :key="previewGeneration"
          class="preview-iframe"
          :style="menuOpen ? { pointerEvents: 'none' } : null"
          frameborder="0"
          width="100%"
          height="100%"
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        ></iframe>
      </div>
    </div>
  </div>
</template>

<script>
import { useEditorStore } from '@/stores/editor';
import { usePreviewStore } from '@/stores/preview';
import previewService from '@/services/preview.service';
import { useWorkspacesStore } from '@/stores/workspaces';
import { mdiDownload, mdiFullscreen, mdiFullscreenExit, mdiInformationOutline } from '@mdi/js';
import { useCommentsStore } from '@/stores/comments';
import { useFilesStore } from '@/stores/files';
import { useNotificationsStore } from '@/stores/notifications';
import { downloadBlob } from '@/utils/api';
import {
  canCommentFromPreview,
  openCommentDialog,
  openThreadsLabel,
  showFileComments,
} from '@/utils/comments';
import {
  enhancePreviewHtml,
  parseHashAction,
  previewFiles,
  showFile,
  syncCommentMarks,
} from '@/utils/preview-html';
import SelectionSelect from '@/components/SelectionSelect.vue';
import { useTypesStore } from '@/stores/types';
import { workspaceSession } from '@/services/events';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function sameList(a, b) {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

const DOWNLOADS = Object.freeze({
  pdf: { label: 'PDF' },
  docx: { label: 'Word' },
});

export default {
  name: 'PreviewPane',
  components: {
    SelectionSelect,
  },
  data() {
    return {
      DOWNLOADS,
      isDownloading: {
        pdf: false,
        docx: false,
      },
      menuOpen: false,
      readingMode: false,
      // Whether the selection options were loaded, which may have found none
      optionsLoaded: false,
      // The owner's edits of a multiple selection while the menu is open; null shows the saved one
      draftSelection: null,
      icons: {
        download: mdiDownload,
        info: mdiInformationOutline,
        readingMode: mdiFullscreen,
        exitReadingMode: mdiFullscreenExit,
      },
    };
  },
  computed: {
    editorStore() {
      return useEditorStore();
    },
    previewStore() {
      return usePreviewStore();
    },
    workspacesStore() {
      return useWorkspacesStore();
    },
    workspaceId() {
      return this.currentWorkspace?.id;
    },
    currentWorkspace() {
      return this.workspacesStore?.currentWorkspace;
    },
    currentType() {
      return useTypesStore().currentType;
    },
    // What the preview is built from, e.g. PFS (saved by the owner, followed by everyone)
    selection() {
      return this.currentType?.selection ?? null;
    },
    hasSelectionBar() {
      return (
        this.previewStore.mode === 'build' &&
        this.selection &&
        (this.selectionOptions.length > 0 || this.optionsLoaded)
      );
    },
    selectionOptions() {
      return this.workspacesStore?.selectionOptions || [];
    },
    selectedItems() {
      return this.draftSelection ?? this.currentWorkspace?.selection ?? [];
    },
    selectValue() {
      return this.selection?.multiple ? this.selectedItems : (this.selectedItems[0] ?? null);
    },
    downloads() {
      return (this.currentType?.downloads ?? []).filter((format) => DOWNLOADS[format]);
    },
    selectionTooltip() {
      const label = this.selection?.label;
      return this.workspacesStore.isOwner
        ? `Changing the selection updates the workspace's ${label}, so everyone with access sees the same preview.`
        : `The workspace owner chooses which ${label} the preview shows.`;
    },
    previewHtml() {
      return this.previewStore.previewHtml;
    },
    previewGeneration() {
      return this.previewStore.previewGeneration;
    },
    isGenerating() {
      return this.previewStore.isGenerating;
    },
    isAnyDownloading() {
      return Object.values(this.isDownloading).some(Boolean);
    },
    // Changes whenever the preview's comment links may need to change
    commentMarks() {
      const { all } = useFilesStore();
      const deleted = Object.keys(all).filter((path) => all[path].status === 'deleted');
      const open = useCommentsStore().openThreads.map((thread) => thread.path);
      return JSON.stringify([this.workspacesStore.canComment, open, deleted]);
    },
    activePath() {
      return this.editorStore.active?.path ?? null;
    },
  },
  async created() {
    if (this.workspaceId && this.previewStore.mode === 'build' && this.selection) {
      try {
        await this.workspacesStore.fetchSelectionOptions(this.workspaceId);
      } catch (error) {
        useNotificationsStore().error(
          `Failed to load the ${this.selection.label}: ${error.message}`,
        );
      }
      this.optionsLoaded = true;
      // Types that select after creation preview the first option until the owner chooses one
      const first = this.selectionOptions[0];
      const { isOwner, isArchived, currentWorkspace } = this.workspacesStore;
      if (
        first &&
        !this.selection.on_create &&
        isOwner &&
        !isArchived &&
        !currentWorkspace?.selection?.length
      ) {
        await this.saveSelection([first.id]);
      }
    }
  },
  async mounted() {
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    // Update iframe content if preview already exists (e.g., returning from Propose view)
    if (this.previewHtml) {
      this.updateIframeContent();
    } else if (!this.previewStore.isGenerating) {
      // Through the queue, so changes arriving during this first build still refresh it afterwards
      await this.previewStore.requestPreviewRefresh();
    }
  },
  beforeUnmount() {
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    this.exitReadingMode();
    // While generating, the iframe is hidden and reads as unscrolled
    if (!this.isGenerating) {
      this.saveScrollPosition();
    }
  },
  watch: {
    // Before the iframe is hidden and recreated
    isGenerating(generating) {
      if (generating) {
        this.saveScrollPosition();
      }
    },
    '$route.hash': {
      // Also when a link was opened in a new tab
      immediate: true,
      handler(hash) {
        const link = parseHashAction(hash);
        if (!link) {
          return;
        }
        const { path: routePath, query } = this.$route;
        this.$router.replace({ path: routePath, query, hash: '' });
        if (link.path.startsWith('/')) {
          // The actions show the file in the editor
          this.exitReadingMode();
          this.runHashAction(link.action, link.path);
        }
      },
    },
    commentMarks() {
      this.syncCommentMarks();
    },
    'previewStore.showRequest'(request) {
      if (request) {
        this.showFile(request);
      }
    },
    async activePath(path) {
      if (
        this.previewStore.mode === 'file' &&
        (path !== this.previewStore.renderedPath || this.previewStore.isGenerating)
      ) {
        await this.previewStore.requestPreviewRefresh();
      }
    },
    // The iframe is keyed by previewGeneration so each regeneration gets a fresh
    // document, forcing images to revalidate (304/404). Reusing the document via
    // doc.write() would reuse already-loaded images ignoring HTTP caching,
    // keeping deleted/changed images visible.
    async previewGeneration() {
      // Wait for the keyed iframe to be recreated
      await this.$nextTick();
      this.updateIframeContent();
    },
  },
  methods: {
    toggleReadingMode() {
      if (this.readingMode) {
        this.exitReadingMode();
      } else {
        this.readingMode = true;
        // The pane covers the window anyway, e.g. where browsers don't allow full screen
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    },
    exitReadingMode() {
      this.readingMode = false;
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    },
    // Leaving full screen, e.g. with Escape, also leaves the reading mode
    onFullscreenChange() {
      if (!document.fullscreenElement) {
        this.readingMode = false;
      }
    },
    runHashAction(action, path) {
      if (action === 'edit') {
        this.editorStore
          .show(path)
          .catch((error) => console.error('Error opening file in editor:', error));
      } else if (action === 'comment' && canCommentFromPreview(path)) {
        openCommentDialog(this.$root, path);
      } else {
        // Also when commenting isn't possible (any more), e.g. the role isn't known yet
        showFileComments(path);
      }
    },
    // Read from the editor, as WebKit runs no listeners in the preview
    saveScrollPosition() {
      const win = this.$refs.iframe?.contentWindow;
      // Until restored, a recreated iframe reads as unscrolled
      if (win && this.previewHtml && !this.restoringScroll) {
        this.previewStore.setScrollPosition(win.scrollX, win.scrollY);
      }
    },
    updateIframeContent() {
      const iframe = this.$refs.iframe;
      if (!iframe) {
        return;
      }

      const oldPosition = this.previewStore.scrollPosition.slice(0);

      // Restore the scroll position once stylesheets and images have loaded, or show the file
      // asked for meanwhile. Listen before writing: without any, it loads during close()
      this.restoringScroll = true;
      iframe.addEventListener(
        'load',
        () => {
          const request = this.pendingShow;
          this.pendingShow = null;
          if (request) {
            showFile(iframe.contentDocument, request.path, request.index);
          } else if (iframe.contentWindow) {
            iframe.contentWindow.scrollTo(...oldPosition);
          }
          this.restoringScroll = false;
        },
        { once: true },
      );

      const parsed = new DOMParser().parseFromString(this.previewHtml, 'text/html');
      enhancePreviewHtml(parsed, {
        // Through the API; the browser sends the session cookie with them
        assetUrl: (path) => `${API_BASE_URL}/workspaces/${this.workspaceId}/previews/${path}`,
        pageUrl: window.location.pathname + window.location.search,
      });
      this.previewStore.setFiles(previewFiles(parsed));
      const doctype = parsed.doctype ? '<!doctype html>' : '';

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(doctype + parsed.documentElement.outerHTML);
      doc.close();
      this.syncCommentMarks();
    },
    // After a collapsed pane has opened, as positions in the preview depend on its width
    async showFile(request) {
      await this.$nextTick();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const doc = this.$refs.iframe?.contentDocument;
      if (this.restoringScroll) {
        this.pendingShow = request;
      } else if (doc && !this.isGenerating) {
        showFile(doc, request.path, request.index);
      }
    },
    syncCommentMarks() {
      const doc = this.$refs.iframe?.contentDocument;
      if (doc) {
        const comments = useCommentsStore();
        syncCommentMarks(doc, {
          canComment: canCommentFromPreview,
          openCount: (path) => comments.openCount(path),
          countLabel: openThreadsLabel,
        });
      }
    },
    handleSelect(value) {
      if (this.selection?.multiple) {
        this.draftSelection = value;
      } else if (value) {
        this.saveSelection([value]);
      }
    },
    // A multiple selection is saved once the menu closes, not on every toggled item
    async handleMenuToggle(open) {
      this.menuOpen = open;
      if (!this.selection?.multiple) {
        return;
      }
      if (open) {
        this.draftSelection = [...this.selectedItems];
        return;
      }
      // On failure the chips fall back to the saved selection
      try {
        if (this.draftSelection) {
          await this.saveSelection(this.draftSelection);
        }
      } finally {
        this.draftSelection = null;
      }
    },
    // Saved on the workspace so viewers and the owner's other tabs show the same preview
    async saveSelection(after) {
      const before = this.currentWorkspace?.selection ?? [];
      if (sameList(before, after)) {
        return;
      }
      const started = workspaceSession();
      try {
        await this.workspacesStore.updateWorkspaceSelection(this.workspaceId, after);
      } catch (error) {
        useNotificationsStore().error(`Failed to save the selection: ${error.message}`);
        return;
      }
      if (started === workspaceSession()) {
        if (!this.selection?.multiple) {
          this.previewStore.setScrollPosition(0, 0);
        }
        await this.previewStore.requestPreviewRefresh();
      }
    },

    async downloadPreview(documentType) {
      const selection = this.currentWorkspace?.selection ?? [];
      if (selection.length === 0) {
        return;
      }
      this.isDownloading[documentType] = true;
      try {
        const response = await this.previewStore.track(() =>
          previewService.downloadPreviewFile(this.workspaceId, selection, documentType),
        );
        const blob = new Blob([response], { type: response.type });
        const name = [this.currentType?.title, ...selection].filter(Boolean).join('-');
        const filename = `${name.replace(/[^\w.-]+/g, '-')}.${documentType}`;
        downloadBlob(blob, filename);
      } catch (error) {
        const notification = useNotificationsStore();
        notification.error('Failed to download preview file: ' + error.message);
      } finally {
        this.isDownloading[documentType] = false;
      }
    },
  },
};
</script>

<style scoped>
/* Above the app bar and drawers, below menus and dialogs */
.reading-mode {
  position: fixed;
  inset: 0;
  z-index: 1010;
  background: rgb(var(--v-theme-surface));
}
</style>
