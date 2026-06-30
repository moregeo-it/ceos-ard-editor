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
      <FileTree
        ref="fileTree"
        v-if="treeItems.length > 0"
        v-model:opened="openedFolders"
        v-model:activated="activatedItems"
        :items="treeItems"
        :loading-paths="filesStore.isPathLoading"
        @update:activated="openActivatedFile"
        @folder-expand="onFolderExpand"
      >
        <template #append="{ item }">
          <FileContextMenu :item="item" />
        </template>
      </FileTree>

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
import FileContextMenu from './FileContextMenu.vue';
import FileTree from './FileTree.vue';
import { mdiFolderOutline, mdiMagnify } from '@mdi/js';

export default {
  name: 'FilesPane',

  components: {
    FileContextMenu,
    FileTree,
  },

  data() {
    return {
      icons: {
        folder: mdiFolderOutline,
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
    async onFolderExpand(item) {
      await this.loadFiles(item.path);
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
     * Scroll the currently activated item into view
     */
    async scrollToActivatedItem() {
      this.$refs.fileTree?.scrollToActivated();
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
  },
};
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
}
</style>
