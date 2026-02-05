<template>
  <v-app id="editor">
    <HeaderBar :title="title" :icon="icons.title">
      <template #central-actions>
        <v-btn-toggle mandatory v-model="view" color="primary">
          <v-btn value="editor" :prepend-icon="icons.edit"> Editor </v-btn>
          <v-btn value="propose" :prepend-icon="icons.propose"> Propose </v-btn>
          <v-btn value="workspaces" :prepend-icon="icons.close"> Close </v-btn>
        </v-btn-toggle>
      </template>
    </HeaderBar>

    <!-- Main Content Area -->
    <v-main v-if="workspace && !loading">
      <ProposeView v-show="view === 'propose'" />
      <EditorView v-show="view === 'editor'" />

      <ArchivedDialog
        v-if="workspacesStore.isArchived"
        :workspace="workspace"
        @activate="handleToggleStatus"
      />
    </v-main>
    <v-container v-else class="fill-height d-flex align-center justify-center">
      <v-progress-circular indeterminate color="primary" size="64" />
    </v-container>
  </v-app>
</template>

<script>
import { useEditorStore } from '@/stores/editor';
import { useNotificationsStore } from '@/stores/notifications';
import { mdiCheckCircle, mdiMenuDown, mdiNotebookEdit, mdiClose } from '@mdi/js';
import ArchivedDialog from '@/components/ide/dialogs/ArchivedDialog.vue';
import HeaderBar from '@/components/common/HeaderBar.vue';
import EditorView from '@/components/EditorView.vue';
import ProposeView from '@/components/ProposeView.vue';
import { useWorkspacesStore } from '@/stores/workspaces';

export default {
  name: 'PfsEditorView',
  components: {
    ArchivedDialog,
    EditorView,
    HeaderBar,
    ProposeView,
  },
  data() {
    return {
      icons: {
        propose: mdiCheckCircle,
        menuDown: mdiMenuDown,
        title: mdiNotebookEdit,
        close: mdiClose,
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
    editorStore() {
      return useEditorStore();
    },
    notificationsStore() {
      return useNotificationsStore();
    },
    workspacesStore() {
      return useWorkspacesStore();
    },
    title() {
      return this.workspace ? this.workspace.title : 'CEOS-ARD Editor';
    },
    view: {
      get() {
        if (typeof this.$route.query.propose !== 'undefined') {
          return 'propose';
        }
        return 'editor';
      },
      set(name) {
        if (name === 'workspaces') {
          this.closeWorkspace();
          return;
        }
        this.$router.push({
          query: name === 'propose' ? { propose: null } : {},
        });
      },
    },
  },

  async created() {
    await this.loadWorkspace();
  },

  methods: {
    async loadWorkspace() {
      try {
        await this.workspacesStore.getWorkspace(this.workspaceId);
      } catch (error) {
        this.notificationsStore.error(`Failed to load workspace: ${error.message}`);
        this.closeWorkspace(true);
      }
    },
    closeWorkspace(force = false) {
      if (this.editorStore.hasUnsavedChanges && !force) {
        // todo: Replace with a Vuetify dialog
        const confirmClose = confirm(
          'You have unsaved changes. Are you sure you want to close the workspace?',
        );
        if (!confirmClose) {
          return;
        }
      }
      this.$router.push({ name: 'workspaces' });
    },
  },
};
</script>
