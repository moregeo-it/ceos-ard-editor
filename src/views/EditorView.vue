<template>
  <v-app v-if="workspace" id="editor">
    <HeaderBar :title="workspace.title" :icon="icons.title">
      <template #central-actions>
        <v-btn
          v-if="!isArchived"
          variant="flat"
          color="success"
          class="mr-2"
          :prepend-icon="icons.propose"
          @click="handlePropose"
          :disabled="loading"
        >
          Propose
        </v-btn>

        <v-btn
          variant="flat"
          color="error"
          class="mr-4"
          :prepend-icon="icons.close"
          @click="closeWorkspace"
        >
          Close
        </v-btn>
      </template>
    </HeaderBar>

    <!-- Main Content Area -->
    <v-main>
      <v-container v-if="loading" class="fill-height d-flex align-center justify-center">
        <v-progress-circular indeterminate color="primary" size="64" />
      </v-container>
      <splitpanes v-else @resized="storePaneSizes" :dbl-click-splitter="false">
        <pane class="files" min-size="10" :size="panelSizes.files">
          <FilesPane />
        </pane>
        <pane class="editor" min-size="30" :size="panelSizes.editor">
          <EditorPane />
        </pane>
        <pane class="preview" min-size="0" :size="panelSizes.preview">
          <PreviewPane />
        </pane>
      </splitpanes>

      <ArchivedDialog v-if="isArchived" :workspace="workspace" @activate="handleToggleStatus" />
    </v-main>
  </v-app>
  <v-container v-else class="fill-height d-flex align-center justify-center">
    <v-progress-circular indeterminate color="primary" size="64" />
  </v-container>
</template>

<script>
import { useAuthStore } from '@/stores/auth';
import { useEditorStore } from '@/stores/editor';
import { useFilesStore } from '@/stores/files';
import { useNotificationsStore } from '@/stores/notifications';
import { usePreviewStore } from '@/stores/preview';
import { useWorkspacesStore } from '@/stores/workspaces';
import { mdiCheckCircle, mdiMenuDown, mdiClose, mdiNotebookEdit } from '@mdi/js';
import EditorPane from '@/components/ide/EditorPane.vue';
import FilesPane from '@/components/ide/FilesPane.vue';
import HeaderBar from '@/components/HeaderBar.vue';
import PreviewPane from '@/components/ide/PreviewPane.vue';
import ArchivedDialog from '@/components/ide/dialogs/ArchivedDialog.vue';
import { Splitpanes, Pane } from 'splitpanes';

export default {
  name: 'EditorView',
  components: {
    ArchivedDialog,
    EditorPane,
    FilesPane,
    HeaderBar,
    Pane,
    PreviewPane,
    Splitpanes,
  },
  data() {
    const panelSizeDefaults = {
      files: 15,
      editor: 50,
      preview: 35,
    };
    return {
      icons: {
        propose: mdiCheckCircle,
        menuDown: mdiMenuDown,
        close: mdiClose,
        title: mdiNotebookEdit,
      },
      panelSizeDefaults: panelSizeDefaults,
      panelSizes: {
        files: localStorage.filesPanelSize ?? panelSizeDefaults.files,
        editor: localStorage.editorPanelSize ?? panelSizeDefaults.editor,
        preview: localStorage.previewPanelSize ?? panelSizeDefaults.preview,
      },
    };
  },

  computed: {
    loading() {
      return this.workspacesStore.isWorkspaceLoading[this.workspaceId];
    },
    workspace() {
      return this.workspacesStore.currentWorkspace;
    },
    workspaceId() {
      return this.$route.params.id;
    },
    isArchived() {
      return this.workspace?.status === 'archived';
    },

    authStore() {
      return useAuthStore();
    },
    editorStore() {
      return useEditorStore();
    },
    filesStore() {
      return useFilesStore();
    },
    previewStore() {
      return usePreviewStore();
    },
    workspacesStore() {
      return useWorkspacesStore();
    },
    notificationsStore() {
      return useNotificationsStore();
    },
  },

  async created() {
    await this.loadWorkspace();
  },

  methods: {
    storePaneSizes: ({ panes }) => {
      if (panes.length === 3) {
        localStorage.filesPanelSize = panes[0].size;
        localStorage.editorPanelSize = panes[1].size;
        localStorage.previewPanelSize = panes[2].size;
      }
    },

    async loadWorkspace() {
      try {
        await this.workspacesStore.getWorkspace(this.workspaceId);
      } catch (error) {
        this.notificationsStore.error(`Failed to load workspace: ${error.message}`);
        this.$router.push({ name: 'workspaces' });
      }
    },

    async handleToggleStatus() {
      try {
        await this.workspacesStore.toggleWorkspaceStatus(this.workspaceId);
        this.notificationsStore.success('Workspace activated successfully');
      } catch (error) {
        this.notificationsStore.error(`Failed to activate workspace: ${error.message}`);
      }
    },

    handlePropose() {
      // TODO: Implement propose functionality
      alert('Propose workspace feature is not implemented yet.');
    },

    async closeWorkspace() {
      this.notificationsStore.reset();
      this.filesStore.reset();
      this.editorStore.reset();
      this.previewStore.reset();
      this.$router.push({ name: 'workspaces' });
    },
  },
};
</script>

<style>
@import '../../node_modules/splitpanes/dist/splitpanes.css';

#editor,
#editor > * {
  height: 100vh !important;
}
#editor .v-main {
  height: calc(100vh - var(--v-layout-top)) !important;
}

.splitpanes .splitpanes__splitter {
  background-color: rgba(var(--v-border-color), var(--v-border-opacity));
  min-width: 4px;
}

.splitpanes .splitpanes__splitter:hover,
.splitpanes .splitpanes__splitter:active,
.splitpanes .splitpanes__splitter:focus {
  background-color: rgba(var(--v-border-color), calc(var(--v-border-opacity) * 2));
}
</style>

<style scoped>
.files,
.editor,
.preview {
  max-height: 100%;
  overflow: hidden;
}
</style>
