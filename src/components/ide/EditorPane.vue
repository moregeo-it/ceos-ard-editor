<template>
  <div class="d-flex flex-column fill-height">
    <template v-if="activeFile">
      <v-tabs
        v-model="model"
        class="editor-tabs"
        density="compact"
        mandatory
        center-active
        scroll-to-active
        show-arrows
        v-bind="colors"
      >
        <v-tab
          v-for="file in openedFiles"
          :key="file.path"
          :value="file.path"
          slim
          @click.middle="close(file.path)"
        >
          <span class="text-none">
            <span class="file-name"> {{ file.name }} </span
            ><span class="file-changed">
              <template v-if="editorStore.changed[file.path]">*</template>
              <template v-else>&nbsp;</template>
            </span>
          </span>
          <v-btn
            :icon="icons.close"
            :loading="editorStore.saving[file.path]"
            size="x-small"
            variant="text"
            @click.stop="close(file.path)"
          />
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
            v-if="!editorStore.original[file.path]"
            class="fill-height d-flex align-center justify-center"
          >
            <v-progress-circular indeterminate color="primary" size="64" />
          </v-container>
          <component
            :is="editorType"
            :value="editorStore.original[file.path]"
            @update="(val) => editorStore.sync(file.path, val)"
            @save="() => editorStore.save(file.path)"
            :file="file"
            :readOnly="isReadOnly"
            class="fill-height"
          />
        </v-tabs-window-item>
      </v-tabs-window>
    </template>
    <div v-else class="fill-height d-flex flex-column align-center justify-center">
      <div class="text-h6 text-subtle">No file is currently opened.</div>
      <div class="text-subtitle-1 text-subtle mt-2">Please open a file to start editing.</div>
    </div>
  </div>
</template>

<script>
import { useEditorStore } from '@/stores/editor';
import { useWorkspacesStore } from '@/stores/workspaces';
import { defineAsyncComponent } from 'vue';
import { mdiClose } from '@mdi/js';
import SourceCodeEditor from './editors/SourceCodeEditor.vue';

export default {
  name: 'EditorPane',

  components: {
    SourceCodeEditor,
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
    colors() {
      return this.$vuetify.theme.name === 'dark'
        ? {
            'bg-color': 'grey-darken-4',
            color: 'white',
          }
        : {
            'bg-color': 'grey-lighten-3',
            color: 'primary',
          };
    },
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
  methods: {
    close(path) {
      if (this.editorStore.saving[path]) {
        return;
      }
      if (this.editorStore.changed[path]) {
        // todo: Replace with a Vuetify dialog
        const confirmClose = window.confirm(
          `The file "${path}" has unsaved changes. Are you sure you want to close it? Unsaved changes will be lost.`,
        );
        if (!confirmClose) {
          return;
        }
      }
      this.editorStore.close(path);
    },
  },
};
</script>

<style lang="css" scoped>
.file-changed {
  width: 0.75rem;
  display: inline-block;
  text-align: left;
}
.editor-tabs {
  min-height: var(--v-tabs-height);
}
:deep(.editor-content > .v-window__container) {
  height: 100%;
}
</style>
