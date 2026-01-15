<template>
  <div class="d-flex flex-column fill-height">
    <template v-if="activeFile">
      <v-tabs
        v-model="model"
        class="editor-tabs"
        bg-color="grey-lighten-3"
        color="primary"
        density="compact"
        mandatory
        center-active
        scroll-to-active
        show-arrows
      >
        <v-tab v-for="file in openedFiles" :key="file.path" :value="file.path" slim>
          <span class="text-none">{{ file.name }}</span>
          <template v-slot:append>
            <v-btn
              :icon="icons.close"
              size="x-small"
              class="ml-2"
              variant="text"
              @click.stop="editorStore.close(file.path)"
            />
          </template>
        </v-tab>
      </v-tabs>

      <v-tabs-window v-model="model" crossfade class="editor-content flex-grow-1">
        <v-tabs-window-item
          v-for="file in openedFiles"
          :key="file.path"
          :value="file.path"
          class="fill-height"
        >
          <v-container
            v-if="!editorStore.data[file.path]"
            class="fill-height d-flex align-center justify-center"
          >
            <v-progress-circular indeterminate color="primary" size="64" />
          </v-container>
          <component
            :is="editorType"
            v-model="editorStore.data[file.path]"
            :file="file"
            :readOnly="isReadOnly"
          />
        </v-tabs-window-item>
      </v-tabs-window>
    </template>
    <div v-else class="fill-height d-flex flex-column align-center justify-center">
      <div class="text-h6 text-grey">No file is currently opened.</div>
      <div class="text-subtitle-1 text-grey mt-2">Please open a file to start editing.</div>
    </div>
  </div>
</template>

<script>
import { useEditorStore } from '@/stores/editor';
import { useWorkspacesStore } from '@/stores/workspaces';
import { defineAsyncComponent } from 'vue';
import { mdiClose } from '@mdi/js';

export default {
  name: 'EditorPane',

  components: {
    SourceCodeEditor: defineAsyncComponent(() => import('./editors/SourceCodeEditor.vue')),
    PfsDocumentEditor: defineAsyncComponent(() => import('./editors/PfsDocumentEditor.vue')),
  },

  data() {
    return {
      icons: {
        close: mdiClose,
      },
    };
  },

  computed: {
    model: {
      get() {
        return this.editorStore.active.path;
      },
      set(value) {
        this.editorStore.show(value);
      },
    },
    workspacesStore() {
      return useWorkspacesStore();
    },
    editorStore() {
      return useEditorStore();
    },
    activeFile() {
      return this.editorStore.active;
    },
    openedFiles() {
      return this.editorStore.opened;
    },
    editorType() {
      return 'SourceCodeEditor';
    },
    isReadOnly() {
      // Determine if the current workspace is read-only (archived)
      const workspace = this.workspacesStore.current;
      return workspace ? workspace.isArchived : false;
    },
  },
};
</script>

<style lang="css" scoped>
.editor-tabs {
  min-height: var(--v-tabs-height);
}
:deep(.editor-content > .v-window__container) {
  height: 100%;
}
</style>
