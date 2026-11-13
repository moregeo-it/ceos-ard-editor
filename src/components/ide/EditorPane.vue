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
            ><span v-if="folderHints[file.path]" class="file-folder text-subtle">
              · {{ folderHints[file.path] }}</span
            ><span class="file-changed">
              <template v-if="editorStore.changed[file.path]">*</template>
              <template v-else>&nbsp;</template>
            </span>
          </span>
          <v-btn
            :icon="icons.close"
            :aria-label="`Close ${file.name}`"
            :loading="editorStore.saving[file.path]"
            size="x-small"
            variant="text"
            @click.stop="close(file.path)"
          />
          <v-tooltip activator="parent" location="bottom" :open-delay="500">
            {{ displayPath(file.path) }}
          </v-tooltip>
        </v-tab>
      </v-tabs>

      <nav
        class="editor-breadcrumbs d-flex align-center text-caption text-subtle px-3"
        aria-label="File path"
      >
        <template v-for="(segment, i) in breadcrumbs" :key="i">
          <v-icon v-if="i" :icon="icons.breadcrumb" size="x-small" class="mx-1" />
          <span :class="{ 'text-high-emphasis': i === breadcrumbs.length - 1 }">{{ segment }}</span>
        </template>
      </nav>

      <v-tabs-window v-model="model" class="editor-content flex-grow-1">
        <v-tabs-window-item
          v-for="file in openedFiles"
          :key="file.path"
          :value="file.path"
          class="fill-height"
          :transition="false"
          :reverse-transition="false"
        >
          <v-container
            v-if="editorStore.data[file.path] === undefined"
            class="fill-height d-flex align-center justify-center"
          >
            <v-progress-circular indeterminate color="primary" size="64" />
          </v-container>
          <component
            v-else
            :is="getEditorType(file, editorStore.data[file.path], file.forceSourceCodeEditor)"
            :value="editorStore.data[file.path]"
            @update="(val) => editorStore.applyEdits(file.path, val)"
            @save="save(file.path)"
            @error="error(file.path, $event)"
            :file="file"
            :readOnly="workspacesStore.isReadOnly"
            class="fill-height"
          />
        </v-tabs-window-item>
      </v-tabs-window>

      <v-toolbar density="compact">
        <!--
        <template v-slot:prepend>
          <v-btn :icon="icons.menu"></v-btn>
        </template>
        -->

        <v-menu v-if="activeFile?.usage?.length" location="top">
          <template #activator="{ props }">
            <v-btn v-bind="props" :append-icon="icons.usage">
              {{ usageLabel }}
              <v-chip size="x-small" class="ml-2">{{ activeFile.usage.length }}</v-chip>
            </v-btn>
          </template>
          <v-list density="compact" max-height="300">
            <v-list-item
              v-for="item in activeFile.usage"
              :key="item.path"
              :title="item.label"
              @click="editorStore.show(item.path)"
            />
          </v-list>
        </v-menu>

        <v-menu v-if="canComment || hasComments" location="top">
          <template #activator="{ props }">
            <v-btn v-bind="props" :append-icon="icons.usage">
              Comments
              <v-chip v-if="openCommentCount" size="x-small" class="ml-2">
                {{ openCommentCount }}
              </v-chip>
            </v-btn>
          </template>
          <v-list density="compact">
            <v-list-item
              v-if="canComment"
              :prepend-icon="icons.addComment"
              title="Add a comment"
              @click="addComment"
            />
            <v-list-item
              v-if="hasComments"
              :prepend-icon="icons.comments"
              title="Show comments"
              @click="commentsStore.showComments(activeFile.path)"
            />
          </v-list>
        </v-menu>

        <template v-slot:append v-if="!workspacesStore.isReadOnly">
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
import { useCommentsStore } from '@/stores/comments';
import { useEditorStore } from '@/stores/editor';
import { useFilesStore } from '@/stores/files';
import { useNotificationsStore } from '@/stores/notifications';
import { useWorkspacesStore } from '@/stores/workspaces';
import { defineAsyncComponent } from 'vue';
import BrowserViewer from './editors/BrowserViewer.vue';
import UnsupportedViewer from './editors/UnsupportedViewer.vue';
import {
  mdiChevronRight,
  mdiClose,
  mdiCommentMultipleOutline,
  mdiCommentPlusOutline,
  mdiContentSave,
  mdiContentSaveAll,
  mdiMenu,
  mdiMenuUp,
} from '@mdi/js';
import { canCommentOn, openCommentDialog } from '@/utils/comments';
import { displayPath, folderHints } from '@/utils/paths';
import { supportVisualEditing } from '@/components/ide/editors/utils';
import { useTypesStore } from '@/stores/types';

const supportedBrowserTypes = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp', // Raster images
  'image/svg+xml', // Vector images
  'application/pdf', // PDF
];

export default {
  name: 'EditorPane',

  components: {
    BrowserViewer,
    SourceCodeEditor: defineAsyncComponent(() => import('./editors/SourceCodeEditor.vue')),
    UnsupportedViewer,
    JsonSchemaEditor: defineAsyncComponent(() => import('./editors/JsonSchemaEditor.vue')),
  },

  data() {
    return {
      icons: {
        addComment: mdiCommentPlusOutline,
        breadcrumb: mdiChevronRight,
        close: mdiClose,
        comments: mdiCommentMultipleOutline,
        menu: mdiMenu,
        save: mdiContentSave,
        usage: mdiMenuUp,
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
    usageLabel() {
      return useTypesStore().currentType?.labels?.usage ?? 'Used in';
    },
    model: {
      get() {
        return this.editorStore.active?.path ?? null;
      },
      set(value) {
        if (typeof value !== 'string' || value.length === 0) {
          return;
        }
        this.editorStore.show(value);
      },
    },
    commentsStore() {
      return useCommentsStore();
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
    breadcrumbs() {
      return this.activeFile.path.split('/').filter(Boolean);
    },
    openCommentCount() {
      return this.commentsStore.openCount(this.activeFile.path);
    },
    canComment() {
      return canCommentOn(this.activeFile.path);
    },
    // Resolved ones too, which the comments pane shows on request
    hasComments() {
      return this.commentsStore.threads.some((thread) => thread.path === this.activeFile.path);
    },
    openedFiles() {
      return this.editorStore.opened;
    },
    // Tells apart open files of the same name, e.g. the document.yaml of each PFS
    folderHints() {
      return folderHints(this.openedFiles.map((file) => file.path));
    },
    hasActiveChanges() {
      return this.activeFile && this.editorStore.changed[this.activeFile.path];
    },
    isActiveSaving() {
      return this.activeFile && this.editorStore.saving[this.activeFile.path];
    },
    hasAnyChanges() {
      return this.editorStore.hasUnsavedChanges;
    },
    isAnySaving() {
      return Object.values(this.editorStore.saving).some((isSaving) => isSaving);
    },
  },
  methods: {
    displayPath,
    getEditorType(file, data, forceSourceCodeEditor = false) {
      if (data instanceof Blob) {
        if (supportedBrowserTypes.includes(data.type)) {
          return 'BrowserViewer';
        } else {
          return 'UnsupportedViewer';
        }
      } else if (supportVisualEditing(file, data) && !forceSourceCodeEditor) {
        return 'JsonSchemaEditor';
      } else {
        return 'SourceCodeEditor';
      }
    },
    addComment() {
      openCommentDialog(this.$root, this.activeFile.path);
    },
    isDeleted(path) {
      const file = this.filesStore.all[path];
      return !file || file.status === 'deleted';
    },
    error(path, error) {
      console.error(error);
      this.close(path);
    },
    async save(path) {
      const result = await this.editorStore.save(path);
      if (result instanceof Error) {
        this.notificationsStore.error(
          `Failed to save file ${displayPath(path)}: ${result.message}`,
        );
      }
    },
    async saveAll() {
      const results = await this.editorStore.saveAll();
      const errorCount = results.filter((res) => res instanceof Error).length;
      const fileCount = results.filter((res) => res).length;
      if (errorCount > 0) {
        this.notificationsStore.error(
          `Failed to save ${errorCount} of ${fileCount} file(s). Please try again.`,
        );
      }
    },
    close(path) {
      if (this.editorStore.saving[path]) {
        return;
      }
      if (this.editorStore.changed[path]) {
        this.$root.openDialog('ConfirmDialog', {
          title: 'Unsaved Changes',
          message: `The file "${displayPath(path)}" has unsaved changes. Are you sure you want to close it? Unsaved changes will be lost.`,
          confirmButton: 'Discard Changes',
          onAcceptance: () => this.editorStore.close(path),
        });
      } else {
        this.editorStore.close(path);
      }
    },
  },
};
</script>

<style lang="css" scoped>
.editor-breadcrumbs {
  min-height: 1.75rem;
  overflow: hidden;
  white-space: nowrap;
  border-bottom: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.file-folder {
  font-size: 0.85em;
}
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
