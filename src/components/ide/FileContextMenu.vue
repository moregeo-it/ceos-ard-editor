<template>
  <v-menu v-if="shouldShowMenu" location="end">
    <template v-slot:activator="{ props }">
      <v-btn
        v-bind="props"
        :icon="icons.menu"
        size="x-small"
        variant="text"
        @click.stop
        @keydown.enter.stop
        @keydown.space.stop
      />
    </template>
    <v-list density="compact">
      <template v-if="isPfsRootFolder">
        <v-list-item @click="requestNewPfs">
          <template v-slot:prepend>
            <v-icon :icon="icons.add" size="small" />
          </template>
          <v-list-item-title>Add New PFS</v-list-item-title>
        </v-list-item>
      </template>

      <template v-else-if="isNewPfsFolder">
        <v-list-item @click="requestRename">
          <template v-slot:prepend>
            <v-icon :icon="icons.rename" size="small" />
          </template>
          <v-list-item-title>Rename</v-list-item-title>
        </v-list-item>

        <v-list-item @click="requestDelete">
          <template v-slot:prepend>
            <v-icon :icon="icons.delete" size="small" color="error" />
          </template>
          <v-list-item-title class="text-error">Delete</v-list-item-title>
        </v-list-item>
      </template>

      <template v-else-if="isPfsFile">
        <v-list-item @click="openFile(item.path, true)">
          <template v-slot:prepend>
            <v-icon :icon="icons.codeeditor" size="small" />
          </template>
          <v-list-item-title>Open in Source Code Editor</v-list-item-title>
        </v-list-item>

        <v-list-item @click="handleDownload">
          <template v-slot:prepend>
            <v-icon :icon="icons.download" size="small" />
          </template>
          <v-list-item-title>Download</v-list-item-title>
        </v-list-item>

        <v-list-item
          v-if="item.status === 'modified' || item.status === 'added'"
          @click="requestDiff"
        >
          <template v-slot:prepend>
            <v-icon :icon="icons.diff" size="small" />
          </template>
          <v-list-item-title>Show Changes</v-list-item-title>
        </v-list-item>

        <v-list-item v-if="item.status === 'modified'" @click="handleRevert">
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
          @click="requestDiff"
        >
          <template v-slot:prepend>
            <v-icon :icon="icons.diff" size="small" />
          </template>
          <v-list-item-title>Show Changes</v-list-item-title>
        </v-list-item>

        <v-list-item v-if="item.status !== 'deleted'" @click="handleDownload">
          <template v-slot:prepend>
            <v-icon :icon="icons.download" size="small" />
          </template>
          <v-list-item-title>Download</v-list-item-title>
        </v-list-item>

        <v-list-item v-if="item.status && item.status !== 'added'" @click="handleRevert">
          <template v-slot:prepend>
            <v-icon :icon="icons.revert" size="small" />
          </template>
          <v-list-item-title>Revert</v-list-item-title>
        </v-list-item>
      </template>

      <template v-else>
        <v-list-item @click="requestNewFile">
          <template v-slot:prepend>
            <v-icon :icon="icons.add" size="small" />
          </template>
          <v-list-item-title>Create</v-list-item-title>
        </v-list-item>
      </template>

      <template v-if="item.status !== 'deleted' && !isPfsItem">
        <v-list-item @click="requestRename">
          <template v-slot:prepend>
            <v-icon :icon="icons.rename" size="small" />
          </template>
          <v-list-item-title>Rename</v-list-item-title>
        </v-list-item>

        <v-list-item @click="requestDelete">
          <template v-slot:prepend>
            <v-icon :icon="icons.delete" size="small" color="error" />
          </template>
          <v-list-item-title class="text-error">Delete</v-list-item-title>
        </v-list-item>
      </template>
    </v-list>
  </v-menu>
</template>

<script>
import { useEditorStore } from '@/stores/editor';
import { useFilesStore } from '@/stores/files';
import { usePreviewStore } from '@/stores/preview';
import { useNotificationsStore } from '@/stores/notifications';
import {
  mdiFileCompare,
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
  name: 'FileContextMenu',

  props: {
    item: {
      type: Object,
      required: true,
    },
  },

  data() {
    return {
      icons: {
        diff: mdiFileCompare,
        add: mdiPlus,
        menu: mdiDotsVertical,
        rename: mdiPencilOutline,
        delete: mdiDeleteOutline,
        revert: mdiUndoVariant,
        download: mdiDownload,
        codeeditor: mdiCodeJson,
      },
    };
  },

  computed: {
    editorStore() {
      return useEditorStore();
    },
    filesStore() {
      return useFilesStore();
    },
    previewStore() {
      return usePreviewStore();
    },
    notificationsStore() {
      return useNotificationsStore();
    },
    shouldShowMenu() {
      if (this.isPfsRootFolder) {
        return true;
      }

      if (this.isPfsFolder) {
        return this.isNewPfsFolder;
      }

      return true;
    },
    isPfsRootFolder() {
      return this.item.type === 'folder' && this.item.path === '/pfs';
    },
    isPfsFolder() {
      return (
        this.item.type === 'folder' &&
        this.item.path.startsWith('/pfs/') &&
        this.item.path !== '/pfs'
      );
    },
    isNewPfsFolder() {
      if (!this.isPfsFolder) {
        return false;
      }

      const documentPath = `${this.item.path}/document.yaml`;
      if (this.filesStore.all[documentPath]?.status === 'added') {
        return true;
      }

      const documentFile = this.item.children?.find((child) => child.path === documentPath);
      return documentFile?.status === 'added';
    },
    isPfsFile() {
      return this.item.type === 'file' && this.isPfsPath(this.item.path);
    },
    isPfsItem() {
      return this.isPfsPath(this.item.path);
    },
  },

  methods: {
    isPfsPath(path) {
      return path === '/pfs' || path.startsWith('/pfs/');
    },

    getPfsFolderId(path) {
      if (typeof path !== 'string') {
        return null;
      }

      const parts = path.split('/').filter(Boolean);
      if (parts.length !== 2 || parts[0] !== 'pfs') {
        return null;
      }

      return parts[1];
    },

    isSelectedPfsFolder(path) {
      const pfsId = this.getPfsFolderId(path);
      if (!pfsId) {
        return false;
      }

      return (
        Array.isArray(this.previewStore.selectedPfs) &&
        this.previewStore.selectedPfs.includes(pfsId)
      );
    },

    openFile(path, forceSourceCodeEditor = false) {
      this.editorStore.show(path, forceSourceCodeEditor);
    },

    requestDiff() {
      this.$root.openDialog('DiffDialog', { item: this.item });
    },

    requestNewFile() {
      this.$root.openDialog('CreateFileDialog', {
        initialPath: this.item.path,
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

    async handleCreatePfs(pfsContent) {
      await this.filesStore.createNewPfs(pfsContent);
      this.notificationsStore.success('PFS created successfully');
    },

    requestRename() {
      this.$root.openDialog('RenameFileDialog', {
        currentName: this.item.name,
        itemType: this.item.type,
        onAcceptance: async (target) => this.handleRename(target),
      });
    },

    async handleRename(target) {
      await this.filesStore.renameFile(this.item.path, target);
      this.notificationsStore.success('Renamed successfully');
    },

    requestDelete() {
      if (this.item.type === 'folder' && this.isSelectedPfsFolder(this.item.path)) {
        this.notificationsStore.warning(
          "You can't delete a PFS that is selected for preview. Deselect it before deleting.",
        );
        return;
      }

      this.$root.openDialog('DeleteFileDialog', {
        name: this.item.name,
        type: this.item.type,
        onAcceptance: async () => await this.handleDelete(),
      });
    },

    async handleDelete() {
      await this.filesStore.deleteFile(this.item.path);
      this.notificationsStore.success('Deleted successfully');
    },

    async handleRevert() {
      try {
        await this.filesStore.revertFile(this.item.path);
        await this.editorStore.sync(this.item.path);
        this.notificationsStore.success('File reverted successfully');
      } catch (error) {
        this.notificationsStore.error(`Failed to revert: ${error.message}`);
      }
    },

    async handleDownload() {
      try {
        const data = await this.filesStore.load(this.item.path);
        downloadBlob(data, this.item.name);
      } catch (error) {
        this.notificationsStore.error(`Failed to start download: ${error.message}`);
      }
    },
  },
};
</script>
