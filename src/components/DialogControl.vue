<template>
  <component
    v-for="dialog of dialogs"
    :key="dialog.component"
    :is="dialog.component"
    v-bind="dialog.props"
    v-on="dialog.events"
    @accept="close(dialog.component)"
    @reject="close(dialog.component)"
  />
</template>

<script>
import { defineAsyncComponent } from 'vue';

// Import all dialog components asynchronously
const components = {
  ArchivedDialog: defineAsyncComponent(() => import('@/components/dialogs/ArchivedDialog.vue')),
  ArchiveWorkspaceDialog: defineAsyncComponent(
    () => import('@/components/dialogs/ArchiveWorkspaceDialog.vue'),
  ),
  ConfirmDialog: defineAsyncComponent(() => import('@/components/dialogs/ConfirmDialog.vue')),
  CreateFileDialog: defineAsyncComponent(() => import('@/components/dialogs/CreateFileDialog.vue')),
  CreatePfsDialog: defineAsyncComponent(() => import('@/components/dialogs/CreatePfsDialog.vue')),
  DeleteFileDialog: defineAsyncComponent(() => import('@/components/dialogs/DeleteFileDialog.vue')),
  DiffDialog: defineAsyncComponent(() => import('@/components/dialogs/DiffDialog.vue')),
  ReauthenticationDialog: defineAsyncComponent(
    () => import('@/components/dialogs/ReauthenticationDialog.vue'),
  ),
  RenameFileDialog: defineAsyncComponent(() => import('@/components/dialogs/RenameFileDialog.vue')),
  WorkspaceDialog: defineAsyncComponent(() => import('@/components/dialogs/WorkspaceDialog.vue')),
};

export default {
  name: 'DialogControl',
  components,
  data() {
    return {
      dialogs: {},
    };
  },
  methods: {
    open(component, props = {}, events = {}) {
      if (!components[component]) {
        console.error(`Dialog component "${component}" not found.`);
        return;
      }
      this.dialogs[component] = { component, props, events };
      return () => this.close(component);
    },
    close(component) {
      delete this.dialogs[component];
    },
    closeAll() {
      this.dialogs = {};
    },
  },
};
</script>
