<template>
  <v-container fluid class="pa-2 d-flex flex-column">
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
        :disabled="filesStore.isLoading"
        :loading="filesStore.isLoading"
        @update:model-value="handleSearch"
        @click:clear="handleClearSearch"
      />
    </div>

    <!-- File Tree -->
    <div class="file-tree-container flex-grow-1 px-2 pt-2">
      <v-alert v-if="filesStore.error" type="error" variant="tonal" class="ma-2">
        {{ filesStore.error }}
      </v-alert>

      <v-treeview
        v-else-if="filesStore.fileTree.length > 0"
        :items="treeItems"
        :indent-lines="true"
        :separate-roots="true"
        density="compact"
        :load-children="loadFolder"
      >
        <template v-slot:prepend="{ item }">
          <v-icon :icon="getFileIcon(item)" size="small" :color="getIconColor(item)" />
        </template>

        <template v-slot:toggle="{ props, item }">
          <VBtn
            key="prepend-toggle"
            density="compact"
            :icon="props.toggleIcon"
            :loading="pathLoading === item.path"
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
                <v-list-item @click="handleDelete(item)">
                  <template v-slot:prepend>
                    <v-icon :icon="icons.delete" size="small" color="error" />
                  </template>
                  <v-list-item-title class="text-error">Delete</v-list-item-title>
                </v-list-item>
              </template>

              <!-- File Actions -->
              <template v-else>
                <v-list-item @click="handleRevert(item)" :disabled="!item.status">
                  <template v-slot:prepend>
                    <v-icon :icon="icons.revert" size="small" />
                  </template>
                  <v-list-item-title>Revert</v-list-item-title>
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
            </v-list>
          </v-menu>
        </template>
      </v-treeview>

      <div v-else-if="filesStore.isLoading" class="text-center pa-4">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <div v-else class="empty-state text-center pa-4">
        <v-icon :icon="icons.folder" size="48" color="grey-lighten-1" />
        <p class="text-grey-lighten-1 mt-2">No files found</p>
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
  </v-container>
</template>

<script>
import { useFilesStore } from '@/stores/files';
import { useWorkspacesStore } from '@/stores/workspaces';
import { useNotificationsStore } from '@/stores/notifications';
import CreateFileDialog from './CreateFileDialog.vue';
import RenameDialog from './RenameDialog.vue';
import DeleteConfirmDialog from './DeleteConfirmDialog.vue';
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
      pathLoading: null,
    };
  },

  computed: {
    filesStore() {
      return useFilesStore();
    },

    workspacesStore() {
      return useWorkspacesStore();
    },

    notificationsStore() {
      return useNotificationsStore();
    },

    workspaceId() {
      return this.workspacesStore.currentWorkspace?.id;
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
      const sourceTree = this.filesStore.searchQuery
        ? this.filesStore.searchResults
        : this.filesStore.fileTree;
      return this.buildTreeItems(sourceTree);
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
      this.pathLoading = item.path;
      await this.loadFiles(item.path);
      this.pathLoading = null;
    },

    async loadFiles(path = '/') {
      try {
        await this.filesStore.loadFileTree(this.workspaceId, path);
      } catch (error) {
        this.notificationsStore.error(`Failed to load files: ${error.message}`);
      }
    },

    handleSearch(value) {
      // Clear existing timeout
      if (this.searchDebounce) {
        clearTimeout(this.searchDebounce);
      }

      // Debounce search to avoid too many requests
      this.searchDebounce = setTimeout(async () => {
        if (!value || !value.trim()) {
          await this.loadFiles();
          return;
        }

        try {
          await this.filesStore.searchFiles(this.workspaceId, value);
        } catch (error) {
          this.notificationsStore.error(`Search failed: ${error.message}`);
        }
      }, 300);
    },

    async handleClearSearch() {
      this.searchQuery = '';
      await this.loadFiles();
    },

    async refreshTree() {
      await this.loadFiles();
    },

    buildTreeItems(nodes, parentPath = '') {
      return nodes.map((node) => {
        const fullPath = parentPath ? `${parentPath}/${node.name}` : node.path;
        return {
          id: fullPath,
          name: node.name,
          type: node.type,
          path: fullPath,
          status: node.status,
          children: node.children ? this.buildTreeItems(node.children, fullPath) : undefined,
        };
      });
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
        await this.filesStore.createFile(this.workspaceId, path, name, type);

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
        await this.filesStore.renameFile(this.workspaceId, this.itemToRename.path, newName);
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
        await this.filesStore.deleteFile(this.workspaceId, this.itemToDelete.path);
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
        await this.filesStore.revertFile(this.workspaceId, item.path);
        this.notificationsStore.success('File reverted successfully');
      } catch (error) {
        this.notificationsStore.error(`Failed to revert: ${error.message}`);
      }
    },
  },
};
</script>

<style scoped>
.file-tree-container {
  overflow-y: auto;
}

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
