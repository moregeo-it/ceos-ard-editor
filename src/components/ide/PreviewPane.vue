<template>
  <v-container fluid class="pa-0 d-flex flex-column">
    <!-- Header with PFS Selector -->
    <div class="pa-2 d-flex align-center border-b">
      <span class="text-subtitle-1 font-weight-medium">Preview</span>

      <v-spacer></v-spacer>

      <v-select
        v-model="selectedPfs"
        :items="pfsOptions"
        label="Select PFS"
        multiple
        chips
        density="compact"
        variant="outlined"
        hide-details
        clearable
        class="preview-select mr-2"
        :prepend-inner-icon="icons.product"
      >
        <template v-slot:chip="{ item, props }">
          <v-chip v-bind="props" size="small">
            {{ item.title }}
          </v-chip>
        </template>
      </v-select>

      <v-btn
        color="primary"
        variant="elevated"
        density="comfortable"
        :prepend-icon="icons.generate"
        :loading="isGenerating"
        @click="handleGenerate"
      >
        Generate
      </v-btn>
    </div>

    <!-- Preview Content -->
    <div class="flex-grow-1 pa-4 preview-content">
      <!-- Loading State -->
      <div v-if="isGenerating" class="text-center pa-8">
        <v-progress-circular indeterminate color="primary" size="64" />
      </div>

      <!-- Empty State -->
      <v-alert v-else-if="!previewHtml" type="info" variant="tonal">
        <div v-if="!hasGenerated">
          Click "Generate" to create a preview using the workspace's PFS, or select specific PFS
          types above.
        </div>
        <div v-else>No preview generated. Please try again.</div>
      </v-alert>

      <!-- Preview Document -->
    </div>
  </v-container>
</template>

<script>
import { useWorkspacesStore } from '@/stores/workspaces';
import { useNotificationsStore } from '@/stores/notifications';
import previewService from '@/services/preview.service';
import { mdiFileDocumentOutline, mdiAutoFix } from '@mdi/js';

export default {
  name: 'PreviewPane',

  data() {
    return {
      icons: {
        product: mdiFileDocumentOutline,
        generate: mdiAutoFix,
      },
      selectedPfs: [],
      previewHtml: '',
      isGenerating: false,
      hasGenerated: false,
    };
  },

  computed: {
    workspacesStore() {
      return useWorkspacesStore();
    },

    notificationsStore() {
      return useNotificationsStore();
    },

    pfsOptions() {
      return this.workspacesStore.pfsOptions || [];
    },

    workspaceId() {
      return this.workspacesStore.currentWorkspace?.id;
    },
  },

  async mounted() {
    await this.generatePreview();
  },

  methods: {
    async handleGenerate() {
      await this.generatePreview(this.selectedPfs.length > 0 ? this.selectedPfs : null);
    },

    async generatePreview(pfs = []) {
      if (!this.workspaceId) {
        this.notificationsStore.error('No workspace loaded');
        return;
      }

      this.isGenerating = true;
      try {
        this.previewHtml = await previewService.generatePreview(this.workspaceId, pfs);
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

<style scoped>
.border-b {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.preview-select {
  max-width: 350px;
  min-width: 250px;
}

.preview-content {
  overflow-y: auto;
}

.preview-html {
  max-height: 600px;
  overflow-y: auto;
}

.preview-html :deep(img) {
  max-width: 100%;
  height: auto;
}

.preview-html :deep(table) {
  width: 100%;
  border-collapse: collapse;
}

.preview-html :deep(table td),
.preview-html :deep(table th) {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding: 8px;
}
</style>
