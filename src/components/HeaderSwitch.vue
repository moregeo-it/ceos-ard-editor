<template>
  <v-btn-toggle mandatory v-model="view" color="primary">
    <v-btn value="editor" :prepend-icon="icons.edit" :ripple="false"> Editor </v-btn>
    <v-btn
      v-if="workspacesStore.isOwner"
      value="propose"
      :prepend-icon="icons.propose"
      :ripple="false"
    >
      Propose
    </v-btn>
    <v-btn
      value="workspaces"
      :prepend-icon="icons.close"
      :ripple="false"
      :loading="proposalStore.isDiffLoading"
    >
      Close
    </v-btn>
  </v-btn-toggle>
</template>

<script>
import { useEditorStore } from '@/stores/editor';
import { useWorkspacesStore } from '@/stores/workspaces';
import { useProposalStore } from '@/stores/proposal';
import { mdiCheckCircle, mdiClose, mdiNotebookEdit } from '@mdi/js';

export default {
  name: 'HeaderSwitch',
  data() {
    return {
      icons: {
        propose: mdiCheckCircle,
        close: mdiClose,
        edit: mdiNotebookEdit,
      },
    };
  },
  computed: {
    editorStore() {
      return useEditorStore();
    },
    workspacesStore() {
      return useWorkspacesStore();
    },
    proposalStore() {
      return useProposalStore();
    },
    view: {
      get() {
        return this.$route.name;
      },
      set(name) {
        if (name === 'workspaces') {
          this.closeWorkspace();
          return;
        }
        this.$router.push({ name });
      },
    },
  },
  methods: {
    closeWorkspace() {
      if (this.editorStore.hasUnsavedChanges) {
        this.$root.openDialog('ConfirmDialog', {
          title: 'Unsaved Changes',
          message: 'You have unsaved changes. Are you sure you want to close the workspace?',
          confirmButton: 'Discard Changes',
          onAcceptance: this.confirmUncommittedChanges,
        });
      } else {
        this.confirmUncommittedChanges();
      }
    },

    // Warn before leaving changes behind that have not been sent to GitHub: the longer they
    // stay uncommitted, the more likely they conflict with changes made on GitHub meanwhile
    async confirmUncommittedChanges() {
      const workspaceId = this.workspacesStore.currentWorkspace?.id;
      // Only the owner can commit, and the change list is owner-only on the server: for
      // read-only collaborators there is nothing to warn about.
      if (!workspaceId || this.workspacesStore.isReadOnly) {
        this.workspacesStore.leaveWorkspace();
        return;
      }

      try {
        await this.proposalStore.fetchDiffList(workspaceId);
      } catch {
        // Without the change list there is nothing to warn about; never block closing
        this.workspacesStore.leaveWorkspace();
        return;
      }

      const files = this.proposalStore.diffList;
      if (!files.length) {
        this.workspacesStore.leaveWorkspace();
        return;
      }

      // The propose view already lists the changes and is where they get committed, so neither
      // the file list nor the review button is needed.
      const inProposeView = this.$route.name === 'propose';

      this.$root.openDialog('UncommittedChangesDialog', {
        files: inProposeView ? [] : files,
        onAcceptance: () => this.workspacesStore.leaveWorkspace(),
        onReview: inProposeView ? null : () => this.$router.push({ name: 'propose' }),
      });
    },
  },
};
</script>
