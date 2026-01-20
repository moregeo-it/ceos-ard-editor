<template>
  <div class="d-flex flex-column fill-height">
    <!-- Search Input -->
    <div class="px-2 pt-2">
      <v-text-field
        v-model="searchQuery"
        :prepend-inner-icon="icons.search"
        placeholder="Search files and folders..."
        density="compact"
        variant="outlined"
        hide-details
        clearable
        :loading="filesStore.isSearchLoading"
        @update:model-value="search"
        @click:clear="clearSearch"
      />
    </div>

    <v-alert v-if="filesStore.error" type="error" variant="tonal" class="ma-2">
      {{ filesStore.error }}
    </v-alert>

    <!-- File Tree -->
    <div class="flex-grow-1 overflow-hidden pa-0 fill-height">
      <v-treeview
        v-if="treeItems.length > 0"
        class="fill-height"
        activatable
        :items="treeItems"
        :indent-lines="true"
        :separate-roots="true"
        density="compact"
        :load-children="loadFolder"
        open-on-click
        item-title="name"
        item-value="path"
        @update:activated="openFile"
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
            @click="props.onClick"
          >
            <template v-slot:loader>
              <VProgressCircular indeterminate="disable-shrink" size="20" width="2" />
            </template>
          </VBtn>
        </template>

        <template v-slot:title="{ item }">
          <div class="file-item d-flex align-center justify-space-between">
            <span class="file-name">{{ item.name }}</span>
            <v-chip
              v-if="item.status"
              size="x-small"
              :color="getStatusColor(item.status)"
              variant="flat"
              class="ml-2"
            >
              {{ item.status }}
            </v-chip>
          </div>
          <div class="text-caption text-pre-wrap text-subtle">
            {{ item.excerpt }}
          </div>
        </template>

        <template v-slot:append="{ item }">
          <v-menu location="end">
            <template v-slot:activator="{ props }">
              <v-btn v-bind="props" :icon="icons.menu" size="x-small" variant="text" @click.stop />
            </template>
            <v-list density="compact">
              <!-- Folder Actions -->
              <template v-if="item.type === 'folder'">
                <v-list-item @click="handleCreateInFolder(item)">
                  <template v-slot:prepend>
                    <v-icon :icon="icons.add" size="small" />
                  </template>
                  <v-list-item-title>Create</v-list-item-title>
                </v-list-item>
                <v-list-item @click="handleRename(item)">
                  <template v-slot:prepend>
                    <v-icon :icon="icons.rename" size="small" />
                  </template>
                  <v-list-item-title>Rename</v-list-item-title>
                </v-list-item>
                <v-list-item @click="handleDelete(item)">
                  <template v-slot:prepend>
                    <v-icon :icon="icons.delete" size="small" color="error" />
                  </template>
                  <v-list-item-title class="text-error">Delete</v-list-item-title>
                </v-list-item>
              </template>

              <!-- File Actions -->
              <template v-else>
                <v-list-item
                  v-if="item.status && item.status !== 'added'"
                  @click="handleRevert(item)"
                >
                  <template v-slot:prepend>
                    <v-icon :icon="icons.revert" size="small" />
                  </template>
                  <v-list-item-title>Revert</v-list-item-title>
                </v-list-item>
                <v-list-item v-if="item.status !== 'deleted'" @click="handleRename(item)">
                  <template v-slot:prepend>
                    <v-icon :icon="icons.rename" size="small" />
                  </template>
                  <v-list-item-title>Rename</v-list-item-title>
                </v-list-item>
                <v-list-item v-if="item.status !== 'deleted'" @click="handleDelete(item)">
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

    <!-- Dialogs -->
    <CreateFileDialog
      v-model:show="showCreateDialog"
      :initial-path="createInitialPath"
      @create="handleCreate"
    />
    <RenameDialog
      v-model:show="showRenameDialog"
      :current-name="itemToRename?.name"
      :item-type="itemToRename?.type"
      @rename="handleRenameConfirm"
    />
    <DeleteConfirmDialog
      v-model:show="showDeleteDialog"
      :item-name="itemToDelete?.name"
      :item-type="itemToDelete?.type"
      @confirm="handleDeleteConfirm"
    />
  </div>
</template>

<script>
import { useEditorStore } from '@/stores/editor';
import { useFilesStore } from '@/stores/files';
import { useNotificationsStore } from '@/stores/notifications';
import { useWorkspacesStore } from '@/stores/workspaces';
import CreateFileDialog from './dialogs/CreateFileDialog.vue';
import RenameDialog from './dialogs/RenameDialog.vue';
import DeleteConfirmDialog from './dialogs/DeleteConfirmDialog.vue';
import {
  mdiFileDocumentOutline,
  mdiFolderOutline,
  mdiFolderOpenOutline,
  mdiMagnify,
  mdiPlus,
  mdiDotsVertical,
  mdiPencilOutline,
  mdiDeleteOutline,
  mdiUndoVariant,
} from '@mdi/js';

export default {
  name: 'FilesPane',

  components: {
    CreateFileDialog,
    RenameDialog,
    DeleteConfirmDialog,
  },

  data() {
    return {
      icons: {
        file: mdiFileDocumentOutline,
        folder: mdiFolderOutline,
        folderOpen: mdiFolderOpenOutline,
        search: mdiMagnify,
        add: mdiPlus,
        menu: mdiDotsVertical,
        rename: mdiPencilOutline,
        delete: mdiDeleteOutline,
        revert: mdiUndoVariant,
      },
      openFolders: [],
      searchQuery: '',
      searchDebounce: null,
      createInitialPath: null,
      itemToRename: null,
      itemToDelete: null,
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
    showCreateDialog: {
      get() {
        return this.createInitialPath !== null;
      },
      set(value) {
        if (!value) {
          this.createInitialPath = null;
        }
      },
    },
    showRenameDialog: {
      get() {
        return !!this.itemToRename;
      },
      set(value) {
        if (!value) {
          this.itemToRename = null;
        }
      },
    },
    showDeleteDialog: {
      get() {
        return !!this.itemToDelete;
      },
      set(value) {
        if (!value) {
          this.itemToDelete = null;
        }
      },
    },
    treeItems() {
      return this.filesStore.searchResults ?? this.filesStore.fileTree;
    },
  },

  async created() {
    await this.loadFiles();
  },

  beforeUnmount() {
    if (this.searchDebounce) {
      clearTimeout(this.searchDebounce);
    }
  },

  methods: {
    async loadFolder(item) {
      await this.loadFiles(item.path);
    },

    async loadFiles(path = '/') {
      try {
        await this.filesStore.loadFiles(path);
      } catch (error) {
        this.notificationsStore.error(`Failed to load files: ${error.message}`);
      }
    },

    openFile(activated) {
      if (activated.length === 0) {
        return;
      }

      const path = activated[0];
      this.editorStore.show(path);
    },

    search(value) {
      // Clear existing timeout
      if (this.searchDebounce) {
        clearTimeout(this.searchDebounce);
      }

      // Debounce search to avoid too many requests
      this.searchDebounce = setTimeout(async () => {
        if (!value || !value.trim()) {
          this.clearSearch();
          return;
        }

        try {
          await this.filesStore.searchFiles(value);
        } catch (error) {
          this.notificationsStore.error(`Search failed: ${error.message}`);
        }
      }, 300);
    },

    async clearSearch() {
      this.searchQuery = '';
      this.filesStore.searchResults = null;
    },

    getFileIcon(item) {
      if (item.type === 'folder') {
        return this.openFolders.includes(item.id) ? this.icons.folderOpen : this.icons.folder;
      }
      return this.icons.file;
    },

    getIconColor(item) {
      if (item.status === 'added') return 'success';
      if (item.status === 'modified') return 'warning';
      if (item.status === 'renamed') return 'info';
      if (item.status === 'deleted') return 'error';
      return undefined;
    },

    getStatusColor(status) {
      switch (status) {
        case 'added':
          return 'success';
        case 'modified':
          return 'warning';
        case 'renamed':
          return 'info';
        case 'deleted':
          return 'error';
        default:
          return 'default';
      }
    },

    handleCreateInFolder(item) {
      this.createInitialPath = item.path;
    },

    async handleCreate({ type, path, name }) {
      try {
        await this.filesStore.createFile(path, name, type);
        this.notificationsStore.success(
          `${type === 'folder' ? 'Folder' : 'File'} created successfully`,
        );
        this.createInitialPath = null;
      } catch (error) {
        this.notificationsStore.error(`Failed to create: ${error.message}`);
      }
    },

    handleRename(item) {
      this.itemToRename = item;
    },

    async handleRenameConfirm(newName) {
      if (!this.itemToRename) return;

      try {
        await this.filesStore.renameFile(this.itemToRename.path, newName);
        this.notificationsStore.success('Renamed successfully');
      } catch (error) {
        this.notificationsStore.error(`Failed to rename: ${error.message}`);
      } finally {
        this.itemToRename = null;
      }
    },

    handleDelete(item) {
      this.itemToDelete = item;
    },

    async handleDeleteConfirm() {
      if (!this.itemToDelete) return;

      try {
        await this.filesStore.deleteFile(this.itemToDelete.path);
        this.notificationsStore.success('Deleted successfully');
        this.itemToDelete = null;
      } catch (error) {
        this.notificationsStore.error(`Failed to delete: ${error.message}`);
      } finally {
        this.itemToDelete = null;
      }
    },

    async handleRevert(item) {
      try {
        await this.filesStore.revertFile(item.path);
        this.notificationsStore.success('File reverted successfully');
      } catch (error) {
        this.notificationsStore.error(`Failed to revert: ${error.message}`);
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
