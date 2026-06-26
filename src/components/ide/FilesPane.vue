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
          <v-menu v-if="shouldShowMenu(item)" location="end">
            <template v-slot:activator="{ props }">
              <v-btn v-bind="props" :icon="icons.menu" size="x-small" variant="text" @click.stop />
            </template>
            <v-list density="compact">
              <template v-if="isPfsRootFolder(item)">
                <v-list-item @click="requestNewPfs">
                  <template v-slot:prepend>
                    <v-icon :icon="icons.add" size="small" />
                  </template>
                  <v-list-item-title>Add New PFS</v-list-item-title>
                </v-list-item>
              </template>

              <template v-else-if="isNewPfsFolder(item)">
                <v-list-item @click="requestRename(item)">
                  <template v-slot:prepend>
                    <v-icon :icon="icons.rename" size="small" />
                  </template>
                  <v-list-item-title>Rename</v-list-item-title>
                </v-list-item>

                <v-list-item @click="requestDelete(item)">
                  <template v-slot:prepend>
                    <v-icon :icon="icons.delete" size="small" color="error" />
                  </template>
                  <v-list-item-title class="text-error">Delete</v-list-item-title>
                </v-list-item>
              </template>

              <template v-else-if="isPfsFile(item)">
                <v-list-item @click="openFile(item.path, true)">
                  <template v-slot:prepend>
                    <v-icon :icon="icons.codeeditor" size="small" />
                  </template>
                  <v-list-item-title>Open in Source Code Editor</v-list-item-title>
                </v-list-item>

                <v-list-item @click="handleDownload(item)">
                  <template v-slot:prepend>
                    <v-icon :icon="icons.download" size="small" />
                  </template>
                  <v-list-item-title>Download</v-list-item-title>
                </v-list-item>

                <v-list-item
                  v-if="item.status === 'modified' || item.status === 'added'"
                  @click="requestDiff(item)"
                >
                  <template v-slot:prepend>
                    <v-icon :icon="icons.diff" size="small" />
                  </template>
                  <v-list-item-title>Show Changes</v-list-item-title>
                </v-list-item>

                <v-list-item v-if="item.status === 'modified'" @click="handleRevert(item)">
                  <template v-slot:prepend>
                    <v-icon :icon="icons.revert" size="small" />
                  </template>
                  <v-list-item-title>Revert</v-list-item-title>
                </v-list-item>
              </template>

              <template v-else-if="item.type === 'file'">
                <v-list-item v-if="item.status !== 'deleted'" @click="openFile(item.path, true)">
                  <template v-slot:prepend>
                    <v-icon :icon="icons.codeeditor" size="small" />
                  </template>
                  <v-list-item-title>Open in Source Code Editor</v-list-item-title>
                </v-list-item>

                <v-list-item
                  v-if="item.status && !['added', 'deleted'].includes(item.status)"
                  @click="requestDiff(item)"
                >
                  <template v-slot:prepend>
                    <v-icon :icon="icons.diff" size="small" />
                  </template>
                  <v-list-item-title>Show Changes</v-list-item-title>
                </v-list-item>

                <v-list-item v-if="item.status !== 'deleted'" @click="handleDownload(item)">
                  <template v-slot:prepend>
                    <v-icon :icon="icons.download" size="small" />
                  </template>
                  <v-list-item-title>Download</v-list-item-title>
                </v-list-item>

                <v-list-item
                  v-if="item.status && item.status !== 'added'"
                  @click="handleRevert(item)"
                >
                  <template v-slot:prepend>
                    <v-icon :icon="icons.revert" size="small" />
                  </template>
                  <v-list-item-title>Revert</v-list-item-title>
                </v-list-item>
              </template>
              <template v-else>
                <v-list-item @click="requestNewFile(item)">
                  <template v-slot:prepend>
                    <v-icon :icon="icons.add" size="small" />
                  </template>
                  <v-list-item-title>Create</v-list-item-title>
                </v-list-item>
              </template>

              <template v-if="item.status !== 'deleted' && !isPfsItem(item)">
                <v-list-item @click="requestRename(item)">
                  <template v-slot:prepend>
                    <v-icon :icon="icons.rename" size="small" />
                  </template>
                  <v-list-item-title>Rename</v-list-item-title>
                </v-list-item>

                <v-list-item @click="requestDelete(item)">
                  <template v-slot:prepend>
                    <v-icon :icon="icons.delete" size="small" color="error" />
                  </template>
                  <v-list-item-title class="text-error">Delete</v-list-item-title>
                </v-list-item>
              </template>
            </v-list>
          </v-menu>
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
import { useWorkspacesStore } from '@/stores/workspaces';
import FileStatusBadge from '../FileStatusBadge.vue';
import {
  mdiFileCompare,
  mdiFileDocumentOutline,
  mdiFolderOutline,
  mdiFolderOpenOutline,
  mdiMagnify,
  mdiPlus,
  mdiDotsVertical,
  mdiPencilOutline,
  mdiDeleteOutline,
  mdiUndoVariant,
  mdiDownload,
  mdiCodeJson,
} from '@mdi/js';
import { downloadBlob } from '@/utils/api';

export default {
  name: 'FilesPane',

  components: {
    FileStatusBadge,
  },

  data() {
    return {
      icons: {
        diff: mdiFileCompare,
        file: mdiFileDocumentOutline,
        folder: mdiFolderOutline,
        folderOpen: mdiFolderOpenOutline,
        search: mdiMagnify,
        add: mdiPlus,
        menu: mdiDotsVertical,
        rename: mdiPencilOutline,
        delete: mdiDeleteOutline,
        revert: mdiUndoVariant,
        download: mdiDownload,
        codeeditor: mdiCodeJson,
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
    workspacesStore() {
      return useWorkspacesStore();
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
    isPfsPath(path) {
      return path === '/pfs' || path.startsWith('/pfs/');
    },

    isPfsRootFolder(item) {
      return item.type === 'folder' && item.path === '/pfs';
    },

    isPfsFolder(item) {
      return item.type === 'folder' && item.path.startsWith('/pfs/') && item.path !== '/pfs';
    },

    isNewPfsFolder(item) {
      if (!this.isPfsFolder(item)) {
        return false;
      }

      const documentPath = `${item.path}/document.yaml`;
      if (this.filesStore.all[documentPath]?.status === 'added') {
        return true;
      }

      const documentFile = item.children?.find((child) => child.path === documentPath);
      return documentFile?.status === 'added';
    },

    shouldShowMenu(item) {
      if (this.isPfsRootFolder(item)) {
        return true;
      }

      if (this.isPfsFolder(item)) {
        return this.isNewPfsFolder(item);
      }

      return true;
    },

    isPfsFile(item) {
      return item.type === 'file' && this.isPfsPath(item.path);
    },

    isPfsItem(item) {
      return this.isPfsPath(item.path);
    },

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

    requestDiff(item) {
      this.$root.openDialog('DiffDialog', { item });
    },

    requestNewFile(item) {
      this.$root.openDialog('CreateFileDialog', {
        initialPath: item.path,
        onAcceptance: this.handleCreate,
      });
    },

    requestNewPfs() {
      this.$root.openDialog('CreatePfsDialog', {
        onAcceptance: this.handleCreatePfs,
      });
    },

    async handleCreate({ type, path, name }) {
      await this.filesStore.createFile(path, name, type);
      this.notificationsStore.success(
        `${type === 'folder' ? 'Folder' : 'File'} created successfully`,
      );
    },

    async handleCreatePfs({ name, sourcePfs }) {
      await this.filesStore.createNewPfs(name, sourcePfs);
      this.notificationsStore.success('PFS created successfully');
    },

    requestRename(source) {
      this.$root.openDialog('RenameFileDialog', {
        currentName: source.name,
        itemType: source.type,
        onAcceptance: async (target) => this.handleRename(source, target),
      });
    },

    async handleRename(source, target) {
      await this.filesStore.renameFile(source.path, target);
      this.notificationsStore.success('Renamed successfully');
    },

    requestDelete(item) {
      this.$root.openDialog('DeleteFileDialog', {
        name: item.name,
        type: item.type,
        onAcceptance: async () => await this.handleDelete(item),
      });
    },

    async handleDelete(item) {
      await this.filesStore.deleteFile(item.path);
      this.notificationsStore.success('Deleted successfully');
    },

    async handleRevert(item) {
      try {
        await this.filesStore.revertFile(item.path);
        await this.editorStore.sync(item.path);
        this.notificationsStore.success('File reverted successfully');
      } catch (error) {
        this.notificationsStore.error(`Failed to revert: ${error.message}`);
      }
    },

    async handleDownload(item) {
      try {
        const data = await this.filesStore.load(item.path);
        downloadBlob(data, item.name);
      } catch (error) {
        this.notificationsStore.error(`Failed to start download: ${error.message}`);
      }
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
