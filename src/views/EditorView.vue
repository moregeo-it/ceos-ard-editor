<template>
  <template v-if="workspace">
    <HeaderBar :title="workspace.title" :icon="icons.title">
      <template #central-actions>
        <HeaderSwitch />
      </template>
      <template #actions>
        <ShareModeChip
          v-if="!workspacesStore.isOwner && workspacesStore.viewerRole"
          :mode="workspacesStore.viewerRole"
        />
        <v-btn v-if="workspacesStore.isOwner" :prepend-icon="icons.share" @click="openShareDialog">
          Share
        </v-btn>
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
import { useNotificationsStore } from '@/stores/notifications';
import { usePreviewStore } from '@/stores/preview';
import { useRealtimeStore } from '@/stores/realtime';
import { useWorkspacesStore } from '@/stores/workspaces';
import { mdiCheckCircle, mdiMenuDown, mdiNotebookEdit, mdiShareVariant } from '@mdi/js';
import HeaderBar from '@/components/HeaderBar.vue';
import HeaderSwitch from '@/components/HeaderSwitch.vue';
import EditorPane from '@/components/ide/EditorPane.vue';
import FilesPane from '@/components/ide/FilesPane.vue';
import PreviewPane from '@/components/ide/PreviewPane.vue';
import ShareModeChip from '@/components/workspace/ShareModeChip.vue';
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
    ShareModeChip,
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
        share: mdiShareVariant,
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
    realtimeStore() {
      return useRealtimeStore();
    },
    editorStore() {
      return useEditorStore();
    },
    previewStore() {
      return usePreviewStore();
    },
  },

  async created() {
    // Must be read before loadWorkspace(), which sets currentWorkspace itself.
    const isFreshOpening = this.workspacesStore.currentWorkspace?.id !== this.workspaceId;

    await this.loadWorkspace();
    // Subscribe to live changes once the workspace has loaded. Everyone connects (the owner's
    // own events are echo-suppressed client-side); read-only viewers get the owner's changes live.
    if (this.workspace) {
      this.realtimeStore.connect(this.workspaceId);
    }
    // Must be called after the workspace has loaded, otherwise isArchived is always false.
    // Only offer reactivation to the owner - collaborators can't reactivate a workspace anyway,
    // they just see it read-only (enforced separately via workspacesStore.isReadOnly).
    if (this.workspacesStore.isArchived && this.workspacesStore.isOwner) {
      this.$root.openDialog('ArchivedDialog', {
        workspace: this.workspace,
        onAcceptance: async () => await this.handleToggleStatus(),
      });
    } else if (isFreshOpening && this.workspacesStore.isOwner) {
      // Syncing pushes and merges with the owner's GitHub credentials and changes the owner's
      // workspace, so only the owner triggers it; collaborators are told about the outcome
      // through the workspace.synced event instead.
      await this.syncRemoteChanges();
    }
    this.syncReady = true;
  },

  beforeUnmount() {
    this.realtimeStore.disconnect();
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

    openShareDialog() {
      this.$root.openDialog('ShareDialog', { workspace: this.workspace });
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
            await this.editorStore.refreshAfterRemoteUpdate();
            this.previewStore.requestPreviewRefresh();
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
