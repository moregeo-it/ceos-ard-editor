<template>
  <div class="d-flex flex-column fill-height">
    <template v-if="activeFile">
      <v-tabs
        v-model="model"
        class="editor-tabs"
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
            <span class="file-name" :class="{ 'file-deleted': isDeleted(file.path) }">{{
              file.name
            }}</span
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
            v-if="editorStore.original[file.path] === undefined"
            class="fill-height d-flex align-center justify-center"
          >
            <v-progress-circular indeterminate color="primary" size="64" />
          </v-container>
          <component
            v-else
            :is="editorType"
            :value="editorStore.original[file.path]"
            @update="(val) => editorStore.sync(file.path, val)"
            @save="save(file.path)"
            :file="file"
            :readOnly="isReadOnly"
            class="fill-height"
          />
        </v-tabs-window-item>
      </v-tabs-window>

      <v-toolbar density="compact">
        <!--
        <template v-slot:prepend>
          <v-btn :icon="icons.menu"></v-btn>
        </template>

        <v-toolbar-title> Used in: ... </v-toolbar-title>
        -->

        <template v-slot:append>
          <v-btn
            :disabled="isActiveSaving || !hasActiveChanges"
            :loading="isActiveSaving"
            @click="save(activeFile.path)"
            ><v-icon :icon="icons.save" /> Save</v-btn
          >
          <v-btn :disabled="isAnySaving || !hasAnyChanges" :loading="isAnySaving" @click="saveAll"
            ><v-icon :icon="icons.saveAll" /> Save All</v-btn
          >
        </template>
      </v-toolbar>
    </template>
    <div v-else class="fill-height d-flex flex-column align-center justify-center">
      <div class="text-h6 text-subtle">No file is currently opened.</div>
      <div class="text-subtitle-1 text-subtle mt-2">Please open a file to start editing.</div>
    </div>
  </div>
</template>

<script>
import { useEditorStore } from '@/stores/editor';
import { useFilesStore } from '@/stores/files';
import { useNotificationsStore } from '@/stores/notifications';
import { useWorkspacesStore } from '@/stores/workspaces';
import { defineAsyncComponent } from 'vue';
import SourceCodeEditor from './editors/SourceCodeEditor.vue';
import { mdiClose, mdiContentSave, mdiContentSaveAll, mdiMenu } from '@mdi/js';

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
        menu: mdiMenu,
        save: mdiContentSave,
        saveAll: mdiContentSaveAll,
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
    editorStore() {
      return useEditorStore();
    },
    filesStore() {
      return useFilesStore();
    },
    notificationsStore() {
      return useNotificationsStore();
    },
    workspacesStore() {
      return useWorkspacesStore();
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
    hasActiveChanges() {
      return this.activeFile && this.editorStore.changed[this.activeFile.path];
    },
    isActiveSaving() {
      return this.activeFile && this.editorStore.saving[this.activeFile.path];
    },
    hasAnyChanges() {
      return this.openedFiles.some((file) => this.editorStore.changed[file.path]);
    },
    isAnySaving() {
      return Object.values(this.editorStore.saving).some((isSaving) => isSaving);
    },
  },
  methods: {
    isDeleted(path) {
      const file = this.filesStore.all[path];
      return !file || file.status === 'deleted';
    },
    async save(path) {
      const result = await this.editorStore.save(path);
      if (result instanceof Error) {
        this.notificationsStore.error(`Failed to save file ${path}: ${result.message}`);
      }
    },
    async saveAll() {
      const results = await this.editorStore.saveAll();
      const errorCount = results.filter((res) => res instanceof Error).length;
      const fileCount = results.filter((res) => res).length;
      if (errorCount > 0) {
        this.notificationsStore.error(
          `Failed to save ${errorCount} of${fileCount} file(s). Please try again.`,
        );
      }
    },
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
.file-deleted {
  text-decoration: line-through;
}
.editor-tabs {
  min-height: var(--v-tabs-height);
}
:deep(.editor-content > .v-window__container) {
  height: 100%;
}
</style>
