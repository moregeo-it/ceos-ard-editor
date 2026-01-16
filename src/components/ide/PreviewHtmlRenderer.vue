<template>
  <div class="preview-iframe-container">
    <iframe
      ref="iframe"
      class="preview-iframe"
      :srcdoc="enhanceHtml"
      frameborder="0"
      width="100%"
      height="100%"
      sandbox="allow-same-origin allow-scripts"
    ></iframe>
  </div>
</template>

<script>
import previewService from '@/services/preview.service';
import { useWorkspacesStore } from '@/stores/workspaces';
import { useNotificationsStore } from '@/stores/notifications';

export default {
  name: 'PreviewHtmlRenderer',
  props: {
    html: {
      type: String,
      required: true,
    },
  },
  computed: {
    notificationsStore() {
      return useNotificationsStore();
    },

    useWorkspacesStore() {
      return useWorkspacesStore();
    },

    workspaceId() {
      return this.useWorkspacesStore.currentWorkspace?.id;
    },
    enhanceHtml() {
      try {
        const parser = new window.DOMParser();
        const doc = parser.parseFromString(this.html, 'text/html');
        const imgs = doc.querySelectorAll('img');
        imgs.forEach((img) => {
          const origSrc = img.getAttribute('src');
          if (origSrc) {
            // Rewrite src to fetch from backend using previewServicethis.fetchStaticFile(origSrc);
          }
        });
        return doc.documentElement.outerHTML;
      } catch (e) {
        this.notificationsStore.error('Error enhancing preview HTML:' + e.message);
        return this.html;
      }
    },
  },

  methods: {
    async fetchStaticFile(filePath) {
      try {
        const response = await previewService.getPreviewStaticFile(this.workspaceId, filePath);
        return response.data;
      } catch (error) {
        console.error('Error fetching static file:', error);
        return null;
      }
    },
  },
};
</script>

<style scoped>
.preview-iframe-container {
  width: 100%;
  height: 100%;
  min-height: 300px;
  background: #fff;
  border-radius: 4px;
  overflow: hidden;
}
.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
}
</style>
