<template>
  <v-btn-toggle mandatory v-model="view" color="primary">
    <v-btn
      v-if="!isArchived"
      value="editor"
      :prepend-icon="icons.edit"
      :ripple="false"
      @click="edit"
    >
      Editor
    </v-btn>
    <v-btn
      v-if="!isArchived"
      value="propose"
      :prepend-icon="icons.propose"
      :ripple="false"
      @click="proposeChanges"
    >
      Propose
    </v-btn>
    <v-btn value="close" :prepend-icon="icons.close" :ripple="false" @click="closeWorkspace">
      Close
    </v-btn>
  </v-btn-toggle>
</template>

<script>
import { useEditorStore } from '@/stores/editor';
import { useFilesStore } from '@/stores/files';
import { useNotificationsStore } from '@/stores/notifications';
import { usePreviewStore } from '@/stores/preview';
import { useWorkspacesStore } from '@/stores/workspaces';
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
    loading() {
      const workspaceId = this.workspacesStore.currentWorkspace?.id;
      if (!workspaceId) return false;
      return this.workspacesStore.isWorkspaceLoading[workspaceId];
    },
    isArchived() {
      return this.workspacesStore.currentWorkspace?.status === 'archived';
    },
    editorStore() {
      return useEditorStore();
    },
    filesStore() {
      return useFilesStore();
    },
    notificationsStore() {
      return useNotificationsStore();
    },
    previewStore() {
      return usePreviewStore();
    },
    workspacesStore() {
      return useWorkspacesStore();
    },
    view() {
      return this.$route.name;
    },
  },
  methods: {
    edit() {
      this.$router.push({ name: 'editor' });
    },
    proposeChanges() {
      this.$router.push({ name: 'propose' });
    },
    closeWorkspace() {
      if (this.editorStore.hasUnsavedChanges) {
        // todo: Replace with a Vuetify dialog
        const confirmClose = confirm(
          'You have unsaved changes. Are you sure you want to close the workspace?',
        );
        if (!confirmClose) {
          return;
        }
      }
      this.editorStore.reset();
      this.filesStore.reset();
      this.notificationsStore.reset();
      this.previewStore.reset();
      this.$router.push({ name: 'workspaces' });
    },
  },
};
</script>
