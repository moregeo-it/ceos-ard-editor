<template>
  <template v-if="workspace">
    <HeaderBar :title="workspace.title" :icon="icons.title">
      <template #central-actions>
        <HeaderSwitch />
      </template>
    </HeaderBar>

    <!-- Main Content Area -->
    <v-main class="main-with-header">
      <v-container
        v-if="loading || !syncReady"
        class="fill-height d-flex align-center justify-center"
      >
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
import { useEditorStore } from '@/stores/editor';
import { useFilesStore } from '@/stores/files';
import { useNotificationsStore } from '@/stores/notifications';
import { usePreviewStore } from '@/stores/preview';
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
      // Panes only mount after the remote sync, so the file tree reads the synced state
      syncReady: false,
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
    editorStore() {
      return useEditorStore();
    },
    filesStore() {
      return useFilesStore();
    },
    previewStore() {
      return usePreviewStore();
    },
  },

  async created() {
    // Must be read before loadWorkspace(), which sets currentWorkspace itself.
    const isFreshOpening = this.workspacesStore.currentWorkspace?.id !== this.workspaceId;

    await this.loadWorkspace();
    // Must be called after the workspace has loaded, otherwise isArchived is always false
    if (this.workspacesStore.isArchived) {
      this.$root.openDialog('ArchivedDialog', {
        workspace: this.workspace,
        onAcceptance: async () => await this.handleToggleStatus(),
      });
    } else if (isFreshOpening) {
      await this.syncRemoteChanges();
    }
    this.syncReady = true;
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
      } catch (error) {
        // Reactivating is the way out of a workspace archived by mistake, so a silent failure
        // here leaves the user with a button that appears to do nothing
        this.notificationsStore.error(`Failed to activate workspace: ${error.message}`);
        return;
      }
      await this.syncRemoteChanges();
      this.notificationsStore.success('Workspace activated successfully');
    },

    async syncRemoteChanges() {
      try {
        const result = await this.workspacesStore.syncWorkspace(this.workspaceId);

        // The fork was recreated behind the scenes. Reported because a repository appearing
        // in someone's GitHub account should never be silent, even when it is a restoration.
        if (result?.repaired) {
          this.notificationsStore.success(
            'Your CEOS-ARD repository was missing on GitHub, so it was recreated and your work was pushed ' +
              'back to it. No changes were lost.',
          );
        }

        switch (result?.status) {
          case 'updated':
          case 'merged':
            this.notificationsStore.success(
              'Workspace updated with the latest changes from GitHub',
            );
            await this.refreshAfterRemoteUpdate();
            break;
          case 'conflict':
            this.$root.openDialog('SyncConflictDialog', {
              workspace: this.workspace,
              files: result.conflicting_files,
            });
            break;
          case 'dirty':
            if (result.behind_commits > 0) {
              this.notificationsStore.warning(
                'New changes exist on GitHub. They will be merged into your workspace ' +
                  'automatically when you commit your local changes.',
              );
            }
            break;
          // The branch is gone and was left alone, because the proposal is merged or closed
          // and deleting the branch was probably deliberate
          case 'remote_missing':
            this.notificationsStore.warning(
              'The GitHub branch for this workspace no longer exists on your CEOS-ARD repository. ' +
                'It will be recreated with your next commit.',
            );
            break;
          // The branch was gone and has been pushed back
          case 'remote_restored':
            // Silent when the fork was recreated too: the message above already covers it
            if (!result.repaired) {
              this.notificationsStore.info(
                'The GitHub branch for this workspace was missing and has been restored ' +
                  'from your local history.',
              );
            }
            break;
        }
      } catch (error) {
        // Never block opening the workspace on a sync failure
        this.notificationsStore.warning(
          `Could not check GitHub for remote updates: ${error.message}`,
        );
      }
    },

    // The sync changed files on disk. Drop the cached file tree so the panes read the updated
    // state, and reload what is already open in the editor.
    async refreshAfterRemoteUpdate() {
      this.filesStore.reset();
      const skipped = await this.editorStore.resyncOpenFiles();
      this.previewStore.generatePreview();

      if (skipped.length) {
        this.notificationsStore.warning(
          'These open files keep your unsaved changes and were not updated with the changes ' +
            `from GitHub: ${skipped.join(', ')}`,
        );
      }
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
