<template>
  <template v-if="workspace">
    <HeaderBar
      :title="workspace.title"
      :icon="icons.title"
      :subtitle="headerType?.title"
      :color="headerType?.color"
    >
      <template #central-actions>
        <HeaderSwitch />
      </template>
      <template #actions>
        <ShareModeChip
          v-if="!workspacesStore.isOwner && workspacesStore.viewerRole"
          :mode="workspacesStore.viewerRole"
        />
        <v-btn
          v-if="workspacesStore.isOwner && upstream?.behind_commits"
          :color="upstreamConflicts ? 'warning' : undefined"
          :prepend-icon="upstreamConflicts ? icons.conflicts : icons.behind"
          @click="openOutdatedBranchDialog"
        >
          {{ upstreamConflicts ? `Conflicts with ${projectName}` : `Behind ${projectName}` }}
        </v-btn>
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
          <SidePane />
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
import { useCommentsStore } from '@/stores/comments';
import { useEditorStore } from '@/stores/editor';
import { useNotificationsStore } from '@/stores/notifications';
import { usePreviewStore } from '@/stores/preview';
import { useRealtimeStore } from '@/stores/realtime';
import { useWorkspacesStore } from '@/stores/workspaces';
import { useTypesStore } from '@/stores/types';
import { mdiAlertOutline, mdiNotebookEdit, mdiShareVariant, mdiSourceBranchSync } from '@mdi/js';
import HeaderBar from '@/components/HeaderBar.vue';
import HeaderSwitch from '@/components/HeaderSwitch.vue';
import EditorPane from '@/components/ide/EditorPane.vue';
import PreviewPane from '@/components/ide/PreviewPane.vue';
import SidePane from '@/components/ide/SidePane.vue';
import ShareModeChip from '@/components/workspace/ShareModeChip.vue';
import { Splitpanes, Pane } from 'splitpanes';

export default {
  name: 'EditorView',
  components: {
    EditorPane,
    HeaderBar,
    HeaderSwitch,
    Pane,
    PreviewPane,
    ShareModeChip,
    SidePane,
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
        title: mdiNotebookEdit,
        share: mdiShareVariant,
        behind: mdiSourceBranchSync,
        conflicts: mdiAlertOutline,
      },
      panelSizeDefaults: panelSizeDefaults,
      panelSizes: {
        files: localStorage.filesPanelSize ?? panelSizeDefaults.files,
        editor: localStorage.editorPanelSize ?? panelSizeDefaults.editor,
        preview: localStorage.previewPanelSize ?? panelSizeDefaults.preview,
      },
      // Panes only mount after the remote sync, so the file tree reads the synced state
      syncReady: false,
      // Set in beforeUnmount: created() and the sync may still resume after their awaits
      unmounted: false,
    };
  },

  computed: {
    // Distinguishes what is edited, only needed with more than one workspace type
    headerType() {
      const typesStore = useTypesStore();
      return typesStore.hasMultipleTypes ? typesStore.currentType : null;
    },
    // The name of what the workspace's repository holds, e.g. CEOS-ARD
    projectName() {
      return useTypesStore().currentType?.title;
    },
    loading() {
      return this.workspacesStore.isWorkspaceLoading[this.workspaceId];
    },
    workspace() {
      return this.workspacesStore.currentWorkspace;
    },
    workspaceId() {
      return this.$route.params.id;
    },
    upstream() {
      return this.workspacesStore.upstream;
    },
    upstreamConflicts() {
      return this.upstream?.conflicting_files.length > 0;
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
    // Must run before loadWorkspace(), which sets currentWorkspace itself.
    const isFreshOpening = this.workspacesStore.enterWorkspace(this.workspaceId);

    const loaded = await this.loadWorkspace();
    if (!loaded) {
      return;
    }
    // Subscribe to live changes once the workspace has loaded. Everyone connects (the server
    // withholds a tab's own changes); read-only viewers get the owner's changes live.
    this.realtimeStore.connect(this.workspaceId);
    // Must be called after the workspace has loaded, otherwise isArchived is always false.
    // Only offer reactivation to the owner.
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
    // After the sync, which can move and delete files the threads are on
    this.loadComments();
    this.syncReady = true;
  },

  beforeUnmount() {
    this.unmounted = true;
  },

  methods: {
    storePaneSizes: ({ panes }) => {
      if (panes.length === 3) {
        localStorage.filesPanelSize = panes[0].size;
        localStorage.editorPanelSize = panes[1].size;
        localStorage.previewPanelSize = panes[2].size;
      }
    },

    /** Whether the workspace loaded and this view is still open */
    async loadWorkspace() {
      try {
        // The panes need the workspace type, e.g. for the form editors and the preview mode
        await Promise.all([
          this.workspacesStore.getWorkspace(this.workspaceId),
          useTypesStore().fetchTypes(),
        ]);
        return !this.unmounted;
      } catch (error) {
        if (!this.unmounted) {
          this.notificationsStore.error(`Failed to load workspace: ${error.message}`);
          this.$router.push({ name: 'workspaces' });
        }
        return false;
      }
    },

    async loadComments() {
      try {
        await useCommentsStore().load();
      } catch (error) {
        if (!this.unmounted) {
          this.notificationsStore.error(`The comments could not be loaded: ${error.message}`);
        }
      }
    },

    openShareDialog() {
      this.$root.openDialog('ShareDialog', { workspace: this.workspace });
    },

    openOutdatedBranchDialog() {
      this.$root.openDialog('OutdatedBranchDialog', {
        workspace: this.workspace,
        upstream: this.upstream,
      });
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
        if (this.unmounted) {
          return;
        }

        // The fork was recreated behind the scenes. Reported because a repository appearing
        // in someone's GitHub account should never be silent, even when it is a restoration.
        if (result?.repaired) {
          this.notificationsStore.success(
            `Your ${this.projectName} repository was missing on GitHub, so it was recreated and your work was pushed ` +
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
            if (this.unmounted) {
              return;
            }
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
              `The GitHub branch for this workspace no longer exists on your ${this.projectName} repository. ` +
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

        // The proposal can't be merged as it is; being behind alone only shows in the header
        if (this.upstreamConflicts) {
          this.notificationsStore.warning(
            `Some of your changes conflict with newer changes in the ${this.projectName} repository. ` +
              `See "Conflicts with ${this.projectName}" at the top for the files.`,
          );
        }
      } catch (error) {
        if (this.unmounted) {
          return;
        }
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
