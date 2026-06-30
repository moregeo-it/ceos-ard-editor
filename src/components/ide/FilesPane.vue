<template>
  <div class="d-flex flex-column fill-height">
    <!-- Search Input -->
    <div class="px-2 pt-3">
      <v-text-field
        v-model="filesStore.searchQuery"
        :prepend-inner-icon="icons.search"
        label="Search files and folders..."
        density="compact"
        variant="outlined"
        hide-details
        clearable
        :loading="filesStore.isSearchLoading"
        @update:model-value="debouncedSearch"
        @click:clear="clearSearch"
      />
    </div>

    <!-- File Tree -->
    <div class="flex-grow-1 overflow-hidden pa-0 fill-height">
      <v-treeview
        ref="treeview"
        v-if="treeItems.length > 0"
        v-model:opened="openedFolders"
        v-model:activated="activatedItems"
        class="fill-height"
        activatable
        :items="treeItems"
        :indent-lines="true"
        :separate-roots="true"
        density="compact"
        open-on-click
        item-title="name"
        item-value="path"
        @update:activated="openActivatedFile"
      >
        <template v-slot:prepend="{ item }">
          <v-icon :icon="getFileIcon(item)" size="small" :color="getIconColor(item)" />
        </template>

        <template v-slot:toggle="{ props, item }">
          <VBtn
            key="prepend-toggle"
            density="compact"
            :icon="props.toggleIcon"
            :loading="filesStore.isPathLoading.includes(item.path)"
            variant="text"
            @click="expandFolder($event, props, item)"
          >
            <template v-slot:loader>
              <VProgressCircular indeterminate="disable-shrink" size="20" width="2" />
            </template>
          </VBtn>
        </template>

        <template v-slot:title="{ item }">
          <div
            class="file-item d-flex align-center justify-space-between"
            @click="item.type === 'folder' && loadFolderOnClick(item)"
          >
            <span class="file-name">{{ item.name }}</span>
            <FileStatusBadge v-if="item.status" :status="item.status" class="ml-2" />
          </div>
          <div class="text-caption text-pre-wrap text-subtle">
            {{ item.excerpt }}
          </div>
        </template>

        <template v-slot:append="{ item }">
          <FileContextMenu :item="item" />
        </template>
      </v-treeview>

      <div v-else-if="filesStore.isPathLoading.includes('/')" class="text-center pa-4">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <div v-else class="empty-state text-center pa-4">
        <v-icon :icon="icons.folder" size="48" class="text-subtle" />
        <p class="text-subtle mt-2">No files found</p>
      </div>
    </div>
  </div>
</template>

<script>
import { useDebounceFn } from '@vueuse/core';
import { useEditorStore } from '@/stores/editor';
import { useFilesStore } from '@/stores/files';
import { useNotificationsStore } from '@/stores/notifications';
import FileStatusBadge from '../FileStatusBadge.vue';
import FileContextMenu from './FileContextMenu.vue';
import {
  mdiFileDocumentOutline,
  mdiFolderOutline,
  mdiFolderOpenOutline,
  mdiMagnify,
} from '@mdi/js';

export default {
  name: 'FilesPane',

  components: {
    FileStatusBadge,
    FileContextMenu,
  },

  data() {
    return {
      icons: {
        file: mdiFileDocumentOutline,
        folder: mdiFolderOutline,
        folderOpen: mdiFolderOpenOutline,
        search: mdiMagnify,
      },
      debouncedSearch: null,
    };
  },

  computed: {
    editorStore() {
      return useEditorStore();
    },
    filesStore() {
      return useFilesStore();
    },
    notificationsStore() {
      return useNotificationsStore();
    },
    treeItems() {
      return this.filesStore.searchResults ?? this.filesStore.fileTree;
    },
    activeFile() {
      return this.editorStore.active;
    },
    openedFolders: {
      get() {
        return this.filesStore.openedFolders;
      },
      set(value) {
        this.filesStore.openedFolders = value;
      },
    },
    activatedItems: {
      get() {
        return this.filesStore.activatedItems;
      },
      set(value) {
        this.filesStore.activatedItems = value;
      },
    },
  },

  watch: {
    activeFile(newFile) {
      if (newFile) {
        this.expandToPath(newFile.path);
      }
    },
    async activatedItems() {
      setTimeout(() => this.scrollToActivatedItem(), 250);
    },
  },

  async created() {
    this.debouncedSearch = useDebounceFn(this.search, 300);
    await this.loadFiles();
  },

  methods: {
    async expandFolder(event, props, item) {
      const isExpanding = !this.openedFolders.includes(item.path);
      props.onClick(event);
      if (isExpanding && item.type === 'folder') {
        await this.loadFiles(item.path);
      }
    },

    async loadFolderOnClick(item) {
      // Load folder contents when clicking on the folder title (text)
      // The open-on-click prop handles toggling, we just need to load the files
      const isExpanding = !this.openedFolders.includes(item.path);
      if (isExpanding) {
        await this.loadFiles(item.path);
      }
    },

    async loadFiles(path = '/') {
      try {
        await this.filesStore.loadFiles(path);
      } catch (error) {
        this.notificationsStore.error(`Failed to load files: ${error.message}`);
      }
    },

    /**
     * Expand the treeview to reveal a specific file path
     * @param {string} filePath - The full path to expand to (e.g., '/folder/subfolder/file.txt')
     */
    async expandToPath(filePath) {
      if (!filePath || filePath === '/') {
        return;
      }

      // Build array of all parent folder paths
      const pathParts = filePath.split('/').filter(Boolean);
      const foldersToOpen = [];
      let currentPath = '';

      // Don't include the last part if it's a file (not a folder)
      const partsToProcess = pathParts.slice(0, -1);

      for (const part of partsToProcess) {
        currentPath = currentPath + '/' + part;
        foldersToOpen.push(currentPath);
      }

      // Load each folder level and expand it
      for (const folderPath of foldersToOpen) {
        await this.loadFiles(folderPath);
      }

      // Update opened folders to include all parent paths
      const newOpened = [...new Set([...this.openedFolders, ...foldersToOpen])];
      this.openedFolders = newOpened;

      // Activate (select) the file
      this.activatedItems = [filePath];
    },

    /**
     * Scroll the currently activated item in the treeview into view
     */
    async scrollToActivatedItem() {
      const treeview = this.$refs.treeview;
      if (!treeview?.$el) {
        return;
      }

      const activatedElement = treeview.$el.querySelector(
        '.v-treeview-item--activated, .v-list-item--active',
      );
      if (activatedElement) {
        activatedElement.scrollIntoView({
          behavior: 'smooth',
        });
      }
    },

    openActivatedFile(activated) {
      if (activated.length === 0) {
        return;
      }

      this.openFile(activated[0]);
    },

    openFile(path, forceSourceCodeEditor = false) {
      this.editorStore.show(path, forceSourceCodeEditor);
    },

    async search(value) {
      value = typeof value === 'string' ? value.trim() : '';
      if (value === '') {
        this.clearSearch();
        return;
      }

      try {
        await this.filesStore.searchFiles(value);
      } catch (error) {
        this.notificationsStore.error(`Search failed: ${error.message}`);
      }
    },

    async clearSearch() {
      this.filesStore.searchQuery = '';
      this.filesStore.searchResults = null;
    },

    getFileIcon(item) {
      if (item.type === 'folder') {
        return this.openedFolders.includes(item.path) ? this.icons.folderOpen : this.icons.folder;
      }
      return this.icons.file;
    },

    getIconColor(item) {
      if (item.status === 'added') return 'green';
      else if (item.status === 'modified') return 'warning';
      else if (item.status === 'renamed') return 'blue';
      else if (item.status === 'deleted') return 'red';
      return undefined;
    },
  },
};
</script>

<style scoped>
.file-item {
  user-select: none;
}

.file-name {
  flex-grow: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
}
</style>
