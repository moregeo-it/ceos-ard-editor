<template>
  <v-container fluid class="pa-2 fill-height d-flex flex-column">
    <!-- Toolbar -->
    <div class="mb-2 d-flex gap-2 align-center">
      <v-btn
        size="small"
        :icon="icons.add"
        @click="showCreateDialog = true"
        title="New File or Folder"
        variant="text"
        density="comfortable"
      />
      <v-btn
        size="small"
        :icon="icons.refresh"
        @click="refreshTree"
        title="Refresh"
        variant="text"
        density="comfortable"
      />
      <v-spacer />
    </div>

    <!-- File Tree -->
    <div class="file-tree-container flex-grow-1">
      <v-progress-linear v-if="filesStore.isLoading" indeterminate />

      <v-alert v-else-if="filesStore.error" type="error" variant="tonal" class="ma-2">
        {{ filesStore.error }}
      </v-alert>

      <v-treeview
        v-else-if="filesStore.fileTree.length > 0"
        :items="treeItems"
        item-value="id"
        item-title="name"
        density="compact"
        open-strategy="multiple"
      >
        <template v-slot:prepend="{ item }">
          <v-icon :icon="getFileIcon(item)" size="small" :color="getIconColor(item)" />
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
      </v-treeview>

      <div v-else class="empty-state text-center pa-4">
        <v-icon :icon="icons.folder" size="48" color="grey-lighten-1" />
        <p class="text-grey-lighten-1 mt-2">No files found</p>
      </div>
    </div>

    <!-- Create File/Folder Dialog -->
    <CreateFileDialog v-model:show="showCreateDialog" @create="handleCreate" />
  </v-container>
</template>

<script>
import { useFilesStore } from '@/stores/files'
import { useNotificationsStore } from '@/stores/notifications'
import CreateFileDialog from './CreateFileDialog.vue'
import {
  mdiFileDocumentOutline,
  mdiFolderOutline,
  mdiFolderOpenOutline,
  mdiRefresh,
  mdiPlus,
} from '@mdi/js'

export default {
  name: 'FilesPane',

  components: {
    CreateFileDialog,
  },

  props: {
    workspaceId: {
      type: [String, Number],
      required: true,
    },
  },

  data() {
    return {
      icons: {
        file: mdiFileDocumentOutline,
        folder: mdiFolderOutline,
        folderOpen: mdiFolderOpenOutline,
        refresh: mdiRefresh,
        add: mdiPlus,
      },
      openFolders: [],
      showCreateDialog: false,
    }
  },

  computed: {
    filesStore() {
      return useFilesStore()
    },

    notificationsStore() {
      return useNotificationsStore()
    },

    treeItems() {
      return this.buildTreeItems(this.filesStore.fileTree)
    },
  },

  async mounted() {
    await this.loadFiles()
  },

  methods: {
    async loadFiles() {
      try {
        await this.filesStore.loadFileTree(this.workspaceId)
      } catch (error) {
        this.notificationsStore.error(`Failed to load files: ${error.message}`)
      }
    },

    async refreshTree() {
      await this.loadFiles()
    },

    buildTreeItems(nodes, parentPath = '') {
      return nodes.map((node) => {
        const fullPath = parentPath ? `${parentPath}/${node.name}` : node.path
        return {
          id: fullPath,
          name: node.name,
          type: node.type,
          path: fullPath,
          status: node.status,
          children: node.children ? this.buildTreeItems(node.children, fullPath) : undefined,
        }
      })
    },

    getFileIcon(item) {
      if (item.type === 'folder') {
        return this.openFolders.includes(item.id) ? this.icons.folderOpen : this.icons.folder
      }
      return this.icons.file
    },

    getIconColor(item) {
      if (item.status === 'added') return 'success'
      if (item.status === 'modified') return 'warning'
      if (item.status === 'renamed') return 'info'
      return undefined
    },

    getStatusColor(status) {
      switch (status) {
        case 'added':
          return 'success'
        case 'modified':
          return 'warning'
        case 'renamed':
          return 'info'
        default:
          return 'default'
      }
    },

    async handleCreate({ type, path, name }) {
      try {
        const isDirectory = type === 'folder'
        await this.filesStore.createFile(this.workspaceId, path, name, isDirectory)

        this.notificationsStore.success(`${isDirectory ? 'Folder' : 'File'} created successfully`)
      } catch (error) {
        this.notificationsStore.error(`Failed to create: ${error.message}`)
      }
    },
  },
}
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
