<template>
  <div class="d-flex flex-column fill-height">
    <div v-if="pfsOptions.length > 0" class="pa-2 pt-3 d-flex align-center border-b-sm">
      <PfsSelect
        v-model="selectedPfs"
        :items="pfsOptions"
        :readonly="!workspacesStore.isOwner"
        label="Select PFS for Preview"
        multiple
        chips
        hide-details
        class="preview-select mr-2 flex-grow-1"
        @update:menu="handleMenuToggle"
      />
      <v-tooltip :text="pfsTooltip" location="bottom" max-width="320">
        <template #activator="{ props }">
          <v-icon
            v-bind="props"
            :icon="icons.info"
            tabindex="0"
            aria-label="About the PFS selection"
          />
        </template>
      </v-tooltip>
      <v-btn
        color="primary"
        class="ml-2"
        :disabled="!previewHtml"
        @click="downloadPreview('pdf')"
        title="Download PDF"
        :loading="isDownloading['pdf']"
      >
        <v-icon>{{ icons.download }}</v-icon>
        PDF
      </v-btn>
      <v-btn
        color="primary"
        class="ml-2"
        :disabled="!previewHtml"
        @click="downloadPreview('docx')"
        title="Download Word Document"
        :loading="isDownloading['docx']"
      >
        <v-icon>{{ icons.download }}</v-icon>
        Word
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
        <template v-if="!workspacesStore.isOwner"
          >The owner has not generated a preview yet.</template
        >
        <template v-else-if="!previewStore.hasSelectedPfs">
          Select at least one PFS from the list above to create a preview.
        </template>
        <template v-else>No preview generated. Please try again.</template>
      </v-alert>

      <!-- Preview Document -->
      <div v-show="!isGenerating && previewHtml" class="fill-height">
        <iframe
          ref="iframe"
          :key="previewGeneration"
          class="preview-iframe"
          :style="pfsMenuOpen ? { pointerEvents: 'none' } : null"
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
import { mdiDownload, mdiInformationOutline } from '@mdi/js';
import { useNotificationsStore } from '@/stores/notifications';
import { downloadBlob } from '@/utils/api';
import PfsSelect from '@/components/PfsSelect.vue';
import { workspaceSession } from '@/services/events';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
// Edit links set this on the editor's URL: WebKit runs no listeners in the sandboxed preview (#192)
const EDIT_HASH = '#edit=';
const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:'];
const XLINK_NS = 'http://www.w3.org/1999/xlink';

function sameList(a, b) {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

export default {
  name: 'PreviewPane',
  components: {
    PfsSelect,
  },
  data() {
    return {
      isDownloading: {
        pdf: false,
        docx: false,
      },
      pfsMenuOpen: false,
      // The owner's edits while the menu is open; null shows the workspace's saved list
      draftPfs: null,
      icons: {
        download: mdiDownload,
        info: mdiInformationOutline,
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
    pfsOptions() {
      return this.workspacesStore?.workspacePfsOptions || [];
    },
    // The workspace's PFS list is the preview selection (saved by the owner, followed by everyone)
    selectedPfs: {
      get() {
        return this.draftPfs ?? this.currentWorkspace?.pfs ?? [];
      },
      set(value) {
        this.draftPfs = value;
      },
    },
    pfsTooltip() {
      return this.workspacesStore.isOwner
        ? "Changing the selection updates the workspace's PFS, as in its settings, so everyone with access sees the same preview."
        : 'The workspace owner chooses which PFS the preview shows.';
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
  },
  async created() {
    if (this.workspaceId) {
      await this.workspacesStore.fetchPfs(this.workspaceId);
    }
  },
  async mounted() {
    // Update iframe content if preview already exists (e.g., returning from Propose view)
    if (this.previewHtml) {
      this.updateIframeContent();
    } else if (!this.previewStore.isGenerating) {
      // Through the queue, so changes arriving during this first build still refresh it afterwards
      await this.previewStore.requestPreviewRefresh();
    }
  },
  beforeUnmount() {
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
      // Also when an Edit link was opened in a new tab
      immediate: true,
      handler(hash) {
        if (!hash.startsWith(EDIT_HASH)) {
          return;
        }
        const path = hash.slice(EDIT_HASH.length);
        const { path: routePath, query } = this.$route;
        this.$router.replace({ path: routePath, query, hash: '' });
        if (path.startsWith('/')) {
          this.editorStore
            .show(path)
            .catch((error) => console.error('Error opening file in editor:', error));
        }
      },
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

      // Restore the scroll position once stylesheets and images have loaded. Listen before
      // writing: without any, it loads during close()
      this.restoringScroll = true;
      iframe.addEventListener(
        'load',
        () => {
          if (iframe.contentWindow) {
            iframe.contentWindow.scrollTo(...oldPosition);
          }
          this.restoringScroll = false;
        },
        { once: true },
      );

      // Rewritten in an inert document: once written, closed shadow roots are out of reach
      const parsed = new DOMParser().parseFromString(this.previewHtml, 'text/html');
      this.enhanceHtml(parsed);
      const doctype = parsed.doctype ? '<!doctype html>' : '';

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(doctype + parsed.documentElement.outerHTML);
      doc.close();
    },
    isAbsoluteUrl(url) {
      return URL.parse(url) !== null;
    },
    enhanceHtml(doc) {
      // These could retarget links (<base>, SVG animations) or escape the rewriting below (frames,
      // templates that become shadow roots)
      doc
        .querySelectorAll('base, animate, set, iframe, frame, object, embed, template')
        .forEach((element) => {
          element.remove();
        });

      // Only edit links may navigate the editor, and only fragments stay in the preview, as a page
      // loaded there keeps the sandbox's permissions. Others open in a new tab, javascript: etc.
      // are dropped
      doc.querySelectorAll('a, area').forEach((link) => {
        const href = link.getAttribute('href') ?? link.getAttributeNS(XLINK_NS, 'href');
        if (href === null || href.startsWith('#')) {
          link.setAttribute('target', '_self');
          return;
        }
        const url = URL.parse(href, doc.baseURI);
        if (url && SAFE_PROTOCOLS.includes(url.protocol)) {
          link.setAttribute('target', '_blank');
          link.setAttribute('rel', 'noopener noreferrer');
        } else {
          link.removeAttribute('href');
          link.removeAttributeNS(XLINK_NS, 'href');
          link.removeAttribute('target');
        }
      });

      // Point relative assets at the API; the browser sends the session cookie with them
      const assetUrl = (path) => `${API_BASE_URL}/workspaces/${this.workspaceId}/previews/${path}`;

      // Fix relative images
      const images = doc.querySelectorAll('img[src]');
      images.forEach((img) => {
        const src = img.getAttribute('src');
        if (src && !this.isAbsoluteUrl(src)) {
          img.setAttribute('src', assetUrl(src));
        }
      });

      // Fix relative stylesheets
      const stylesheets = doc.querySelectorAll('link[rel="stylesheet"]');
      stylesheets.forEach((sheet) => {
        const href = sheet.getAttribute('href');
        if (href && !this.isAbsoluteUrl(href)) {
          sheet.setAttribute('href', assetUrl(href));
        }
      });

      // The server's Edit buttons become links that open the file through the editor's URL
      const { pathname, search } = window.location;
      doc.querySelectorAll('button[class="edit"]').forEach((btn) => {
        const path = btn.getAttribute('value');
        if (!path) {
          return;
        }
        const link = doc.createElement('a');
        link.className = 'edit';
        link.textContent = btn.textContent;
        link.href = `${pathname}${search}${EDIT_HASH}${encodeURIComponent(path)}`;
        link.target = '_top';
        // The browser's button font keeps the button's size; the last supported keyword wins
        link.style.cssText =
          'float: right; display: inline-block; margin: 0 0 0.5rem 0.5rem;' +
          'padding: 0.3rem 0.8rem; background-color: #007bff; color: white; border-radius: 4px;' +
          'text-decoration: none; transition: background-color 0.2s ease;' +
          'font: 13.3333px sans-serif; font: -moz-button; font: -webkit-small-control;';
        btn.replaceWith(link);
      });
      const style = doc.createElement('style');
      style.textContent =
        'a.edit:hover, a.edit:focus-visible { background-color: #0069d9 !important; }';
      doc.head.append(style);
    },
    // Save and regenerate once the menu closes, not on every toggled item of the multi-select
    async handleMenuToggle(open) {
      this.pfsMenuOpen = open;
      if (open) {
        this.draftPfs = [...this.selectedPfs];
        return;
      }
      const before = this.currentWorkspace?.pfs ?? [];
      const after = this.draftPfs ?? before;
      if (sameList(before, after)) {
        this.draftPfs = null;
        return;
      }
      // Saved on the workspace so viewers and the owner's other tabs show the same preview; on
      // failure the chips fall back to the saved list
      const started = workspaceSession();
      try {
        await this.workspacesStore.updateWorkspacePfs(this.workspaceId, after);
      } catch (error) {
        useNotificationsStore().error(`Failed to save the PFS selection: ${error.message}`);
        return;
      } finally {
        this.draftPfs = null;
      }
      if (started === workspaceSession()) {
        await this.previewStore.requestPreviewRefresh();
      }
    },

    async downloadPreview(documentType) {
      if (!this.selectedPfs || this.selectedPfs.length === 0) {
        return;
      }
      this.isDownloading[documentType] = true;
      try {
        const response = await this.previewStore.track(() =>
          previewService.downloadPreviewFile(this.workspaceId, this.selectedPfs, documentType),
        );
        const blob = new Blob([response], { type: response.type });
        const filename = `CEOS-ARD-${this.selectedPfs.join('-')}.${documentType}`;
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
