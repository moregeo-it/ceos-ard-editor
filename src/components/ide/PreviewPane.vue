<template>
  <div class="d-flex flex-column fill-height">
    <div class="pa-2 pt-3 d-flex align-center border-b-sm">
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
        <div v-if="!hasGenerated">
          Select at least one PFS from the list above to create a preview.
        </div>
        <div v-else>No preview generated. Please try again.</div>
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
import { useNotificationsStore } from '@/stores/notifications';
import { useWorkspacesStore } from '@/stores/workspaces';
import previewService from '@/services/preview.service';
import { mdiFileDocumentOutline } from '@mdi/js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default {
  name: 'PreviewPane',
  data() {
    return {
      icons: {
        product: mdiFileDocumentOutline,
      },
      selectedPfs: [],
      oldSelectedPfs: null,
      previewHtml: '',
      isGenerating: false,
      hasGenerated: false,
      scrollPosition: {
        value: { x: 0, y: 0 },
      },
    };
  },
  created() {
    this.selectedPfs = this.workspacesStore.currentWorkspace.pfs;
  },
  computed: {
    authStore() {
      return useAuthStore();
    },
    editorStore() {
      return useEditorStore();
    },
    notificationsStore() {
      return useNotificationsStore();
    },
    workspacesStore() {
      return useWorkspacesStore();
    },
    workspaceId() {
      return this.workspacesStore?.currentWorkspace?.id;
    },
    pfsOptions() {
      return this.workspacesStore?.pfsOptions || [];
    },
  },
  async mounted() {
    await this.generatePreview();
  },
  watch: {
    previewHtml() {
      this.updateIframeContent();
    },
  },
  methods: {
    updateIframeContent() {
      const previewFrame = this.$refs.iframe;
      console.log(previewFrame);
      if (!previewFrame) {
        return;
      }

      const iframe = previewFrame;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

      // Save current scroll position before updating content
      if (iframe.contentWindow) {
        this.scrollPosition = {
          x: iframe.contentWindow.scrollX,
          y: iframe.contentWindow.scrollY,
        };
      }

      // Write content to iframe
      iframeDoc.open();
      iframeDoc.write(this.previewHtml);
      iframeDoc.close();

      // Fix relative URLs in the iframe content
      this.enhanceHtml(iframeDoc);

      // Restore scroll position after content has been updated and rendered
      setTimeout(() => {
        if (iframe.contentWindow) {
          iframe.contentWindow.scrollTo(this.scrollPosition.x, this.scrollPosition.y);
        }
      }, 100);
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

      return doc;
    },
    async handleSelect(focus) {
      if (focus) {
        this.oldSelectedPfs = this.selectedPfs;
        return;
      }
      if (this.oldSelectedPfs === this.selectedPfs) {
        return;
      }
      await this.generatePreview();
      this.oldSelectedPfs = null;
    },
    async generatePreview() {
      if (this.selectedPfs.length === 0) {
        return;
      }
      this.isGenerating = true;
      try {
        this.previewHtml = await previewService.generatePreview(this.workspaceId, this.selectedPfs);
      } catch (error) {
        this.notificationsStore.error(`Failed to generate preview: ${error.message}`);
        this.previewHtml = '';
      } finally {
        this.isGenerating = false;
      }
    },
  },
};
</script>
