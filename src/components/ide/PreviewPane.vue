<template>
  <div class="d-flex flex-column fill-height">
    <div v-if="pfsOptions.length > 0" class="pa-2 pt-3 d-flex align-center border-b-sm">
      <v-select
        v-model="selectedPfs"
        :items="pfsOptions"
        label="Select PFS for Preview"
        multiple
        chips
        density="compact"
        variant="outlined"
        hide-details
        item-title="id"
        item-value="id"
        class="preview-select mr-2 flex-grow-1"
        :prepend-inner-icon="icons.product"
        @update:focused="handleSelect"
      >
        <template v-slot:chip="{ item, props }">
          <v-chip v-bind="props" size="small">
            {{ item.title }}
          </v-chip>
        </template>
      </v-select>
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
      <div v-if="isGenerating" class="text-center pa-8 ma-4">
        <v-progress-circular indeterminate color="primary" size="64" />
      </div>

      <v-alert v-else-if="!previewHtml" type="info" variant="tonal" class="ma-4">
        <template v-if="!previewStore.hasSelectedPfs">
          Select at least one PFS from the list above to create a preview.
        </template>
        <template v-else>No preview generated. Please try again.</template>
      </v-alert>

      <!-- Preview Document -->
      <div v-show="!isGenerating && previewHtml" class="fill-height">
        <iframe
          ref="iframe"
          class="preview-iframe"
          frameborder="0"
          width="100%"
          height="100%"
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        ></iframe>
      </div>
    </div>
  </div>
</template>

<script>
import { useAuthStore } from '@/stores/auth';
import { useEditorStore } from '@/stores/editor';
import { usePreviewStore } from '@/stores/preview';
import previewService from '@/services/preview.service';
import { useWorkspacesStore } from '@/stores/workspaces';
import { mdiFileDocumentOutline, mdiDownload } from '@mdi/js';
import { useNotificationsStore } from '@/stores/notifications';
import { downloadBlob } from '@/utils/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default {
  name: 'PreviewPane',
  data() {
    return {
      isDownloading: {
        pdf: false,
        docx: false,
      },
      icons: {
        download: mdiDownload,
        product: mdiFileDocumentOutline,
      },
    };
  },
  computed: {
    authStore() {
      return useAuthStore();
    },
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
    selectedPfs: {
      get() {
        return this.previewStore.selectedPfs;
      },
      set(value) {
        this.previewStore.setSelectedPfs(value);
      },
    },
    previewHtml() {
      return this.previewStore.previewHtml;
    },
    isGenerating() {
      return this.previewStore.isGenerating;
    },
  },
  async created() {
    if (this.selectedPfs === null) {
      this.selectedPfs = this.currentWorkspace.pfs || [];
    }
    if (this.pfsOptions.length === 0 && this.workspaceId) {
      await this.workspacesStore.fetchWorkspacePfs(this.workspaceId);
    }
  },
  async mounted() {
    // Update iframe content if preview already exists (e.g., returning from Propose view)
    if (this.previewHtml) {
      this.updateIframeContent();
    } else {
      await this.previewStore.generatePreview();
    }
  },
  watch: {
    previewHtml() {
      this.updateIframeContent();
    },
  },
  methods: {
    updateIframeContent() {
      const iframe = this.$refs.iframe;
      if (!iframe) {
        return;
      }

      // Save old scroll position to ensure scrollend event doesn't override it
      const oldPosition = this.previewStore.scrollPosition.slice(0);

      // Write content to iframe
      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(this.previewHtml);
      doc.close();

      // Add scrollend listener to track scroll position for restoration after regeneration
      doc.addEventListener('scrollend', () => {
        if (iframe.contentWindow) {
          this.previewStore.setScrollPosition(
            iframe.contentWindow.scrollX,
            iframe.contentWindow.scrollY,
          );
        }
      });

      // Restore scroll position after all resources (stylesheets, images) are loaded
      iframe.addEventListener(
        'load',
        () => {
          if (iframe.contentWindow) {
            iframe.contentWindow.scrollTo(...oldPosition);
          }
        },
        { once: true },
      );

      // Fix relative URLs in the iframe content
      this.enhanceHtml(doc);
    },
    enhanceHtml(doc) {
      const token = this.authStore.accessToken;

      // Fix relative links and target
      const links = doc.querySelectorAll('a[href]');
      links.forEach((link) => {
        const href = link.getAttribute('href');
        const url = URL.parse(href);
        if (url !== null) {
          // Valid absolute URL (or mailto: link for example)
          link.setAttribute('target', '_blank');
        }
      });

      // Fix relative images
      const images = doc.querySelectorAll('img[src]');
      images.forEach((img) => {
        const src = img.getAttribute('src');
        if (src && !src.match(/^https?:\/\//i)) {
          img.setAttribute(
            'src',
            `${API_BASE_URL}/workspaces/${this.workspaceId}/previews/${src}?authorization=${token}`,
          );
        }
      });

      // Fix relative stylesheets
      const stylesheets = doc.querySelectorAll('link[rel="stylesheet"]');
      stylesheets.forEach((sheet) => {
        const href = sheet.getAttribute('href');
        if (href && !href.match(/^https?:\/\//i)) {
          sheet.setAttribute(
            'href',
            `${API_BASE_URL}/workspaces/${this.workspaceId}/previews/${href}?authorization=${token}`,
          );
        }
      });

      // Make Edit buttons clickable
      const editBtns = doc.querySelectorAll('button[class="edit"]');
      editBtns.forEach((btn) => {
        const href = btn.getAttribute('value');
        if (href) {
          btn.addEventListener('click', () => {
            this.editorStore
              .show(href)
              .catch((error) => console.error('Error opening file in editor:', error));
          });
          btn.addEventListener('mouseover', () => {
            btn.style.backgroundColor = '#0069d9';
          });
          btn.addEventListener('focus', () => {
            btn.style.backgroundColor = '#0069d9';
          });
          btn.addEventListener('mouseout', () => {
            btn.style.backgroundColor = '#007bff';
          });
          btn.addEventListener('blur', () => {
            btn.style.backgroundColor = '#007bff';
          });
          btn.style.float = 'right';
          btn.style.margin = `0 0 0.5rem 0.5rem`;
          btn.style.padding = '0.3rem 0.8rem';
          btn.style.backgroundColor = '#007bff';
          btn.style.color = 'white';
          btn.style.border = 0;
          btn.style.borderRadius = '4px';
          btn.style.cursor = 'pointer';
          btn.style.transition = 'all 0.2s ease';
        }
      });
    },
    async handleSelect(focus) {
      if (focus) {
        this.previewStore.storeOldSelection();
        return;
      }
      if (this.previewStore.oldSelectedPfs === this.previewStore.selectedPfs) {
        return;
      }
      await this.previewStore.generatePreview();
      this.previewStore.clearOldSelection();
    },

    async downloadPreview(documentType) {
      this.isDownloading[documentType] = true;

      if (!this.selectedPfs || this.selectedPfs.length === 0) {
        return;
      }
      try {
        const response = await previewService.downloadPreviewFile(
          this.workspaceId,
          this.selectedPfs,
          documentType,
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
