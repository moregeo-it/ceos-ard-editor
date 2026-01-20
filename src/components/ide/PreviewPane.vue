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
    </div>

    <div class="flex-grow-1 pa-4">
      <div v-if="isGenerating" class="text-center pa-8">
        <v-progress-circular indeterminate color="primary" size="64" />
      </div>

      <v-alert v-else-if="!previewHtml" type="info" variant="tonal">
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
          sandbox="allow-same-origin"
        ></iframe>
      </div>
    </div>
  </div>
</template>

<script>
import { useAuthStore } from '@/stores/auth';
import { useEditorStore } from '@/stores/editor';
import { usePreviewStore } from '@/stores/preview';
import { useWorkspacesStore } from '@/stores/workspaces';
import { mdiFileDocumentOutline } from '@mdi/js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default {
  name: 'PreviewPane',
  data() {
    return {
      icons: {
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
      return this.workspacesStore?.pfsOptions || [];
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
    if (this.pfsOptions.length === 0) {
      await this.workspacesStore.fetchPfs();
    }
  },
  async mounted() {
    await this.previewStore.generatePreview();
  },
  watch: {
    previewHtml() {
      this.updateIframeContent();
    },
    currentWorkspace: {
      handler(newVal) {
        this.selectedPfs = newVal?.pfs || [];
      },
      immediate: true,
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

      // Fix relative links
      const links = doc.querySelectorAll('a[href]');
      links.forEach((link) => {
        const href = link.getAttribute('href');
        if (href && !href.startsWith('http') && !href.startsWith('#')) {
          link.setAttribute(
            'href',
            `${API_BASE_URL}/workspaces/${this.workspaceId}/previews/${href}?authorization=${token}`,
          );
        }
      });

      // Fix relative images
      const images = doc.querySelectorAll('img[src]');
      images.forEach((img) => {
        const src = img.getAttribute('src');
        if (src && !src.startsWith('http')) {
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
        if (href && !href.startsWith('http')) {
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
      if (!this.previewStore.hasSelectionChanged) {
        return;
      }
      await this.previewStore.generatePreview();
      this.previewStore.clearOldSelection();
    },
  },
};
</script>
