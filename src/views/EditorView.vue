<template>
  <template v-if="workspace">
    <HeaderBar :title="workspace.title" :icon="icons.title">
      <template #central-actions>
        <HeaderSwitch />
      </template>
    </HeaderBar>

    <!-- Main Content Area -->
    <v-main class="main-with-header">
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
    </v-main>
  </template>
  <v-container v-else class="fill-height d-flex align-center justify-center">
    <v-progress-circular indeterminate color="primary" size="64" />
  </v-container>
</template>

<script>
import { useNotificationsStore } from '@/stores/notifications';
import { useWorkspacesStore } from '@/stores/workspaces';
import { mdiCheckCircle, mdiMenuDown, mdiNotebookEdit } from '@mdi/js';
import HeaderBar from '@/components/HeaderBar.vue';
import HeaderSwitch from '@/components/HeaderSwitch.vue';
import EditorPane from '@/components/ide/EditorPane.vue';
import FilesPane from '@/components/ide/FilesPane.vue';
import PreviewPane from '@/components/ide/PreviewPane.vue';
import { Splitpanes, Pane } from 'splitpanes';

export default {
  name: 'EditorView',
  components: {
    EditorPane,
    FilesPane,
    HeaderBar,
    HeaderSwitch,
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
    workspacesStore() {
      return useWorkspacesStore();
    },
    notificationsStore() {
      return useNotificationsStore();
    },
  },

  async created() {
    await this.loadWorkspace();
    // Must be called after the workspace has loaded, otherwise isArchived is always false
    if (this.workspacesStore.isArchived) {
      this.$root.openDialog('ArchivedDialog', {
        workspace: this.workspace,
        onAcceptance: async () => await this.handleToggleStatus(),
      });
    }
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
      await this.workspacesStore.toggleWorkspaceStatus(this.workspaceId);
      this.notificationsStore.success('Workspace activated successfully');
    },
  },
};
</script>

<style>
@import '../../node_modules/splitpanes/dist/splitpanes.css';
@import './split.css';
</style>

<style scoped>
.files,
.editor,
.preview {
  max-height: 100%;
  overflow: hidden;
}
</style>
