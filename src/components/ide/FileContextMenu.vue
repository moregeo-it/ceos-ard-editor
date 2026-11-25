<template>
  <v-menu v-if="entries.length > 0" location="end">
    <template v-slot:activator="{ props }">
      <v-btn
        v-bind="props"
        :icon="icons.menu"
        :aria-label="`Actions for ${item.name}`"
        size="x-small"
        variant="text"
        @click.stop
        @keydown.enter.stop
        @keydown.space.stop
      />
    </template>
    <v-list density="compact">
      <v-list-item v-for="entry in entries" :key="entry.id" @click="entry.handler">
        <template v-slot:prepend>
          <v-icon :icon="entry.icon" size="small" :color="entry.color" />
        </template>
        <v-list-item-title :class="entry.color ? `text-${entry.color}` : null">{{
          entry.title
        }}</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script>
import { useEditorStore } from '@/stores/editor';
import { useFilesStore } from '@/stores/files';
import { useNotificationsStore } from '@/stores/notifications';
import {
  mdiCommentPlusOutline,
  mdiFileCompare,
  mdiPlus,
  mdiDotsVertical,
  mdiPencilOutline,
  mdiDeleteOutline,
  mdiUndoVariant,
  mdiDownload,
  mdiCodeJson,
  mdiUpload,
} from '@mdi/js';
import { downloadBlob } from '@/utils/api';
import { useTypesStore } from '@/stores/types';
import { useWorkspacesStore } from '@/stores/workspaces';
import { matchesGlob } from '@/utils/glob';
import { openCommentDialog } from '@/utils/comments';

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
        comment: mdiCommentPlusOutline,
        diff: mdiFileCompare,
        add: mdiPlus,
        menu: mdiDotsVertical,
        rename: mdiPencilOutline,
        delete: mdiDeleteOutline,
        revert: mdiUndoVariant,
        download: mdiDownload,
        codeeditor: mdiCodeJson,
        upload: mdiUpload,
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
    notificationsStore() {
      return useNotificationsStore();
    },
    workspacesStore() {
      return useWorkspacesStore();
    },
    // The file menu rules of the workspace type: the last rule matching the path decides
    operations() {
      const kind = this.item.type === 'folder' ? 'folder' : 'file';
      const rules = useTypesStore().currentType?.file_menu ?? [];
      const rule = rules.findLast(
        (rule) => (rule.kind ?? kind) === kind && matchesGlob(this.item.path, rule.match),
      );
      const operations = new Set(rule?.ops ?? []);
      if (this.isNew) {
        (rule?.ops_if_new ?? []).forEach((operation) => operations.add(operation));
      }
      return operations;
    },
    // Not committed yet: a new file, or a folder with only new files (as far as loaded)
    isNew() {
      if (this.item.type !== 'folder') {
        return this.item.status === 'added';
      }
      const prefix = `${this.item.path}/`;
      const files = Object.values(this.filesStore.all).filter(
        (file) => !file.is_directory && file.path.startsWith(prefix),
      );
      return files.length > 0 && files.every((file) => file.status === 'added');
    },
    entries() {
      const { status, type } = this.item;
      const isFile = type === 'file';
      const editable = !this.workspacesStore.isReadOnly;
      const exists = status !== 'deleted';
      const allows = (operation) => this.operations.has(operation);
      const actions = useTypesStore().currentType?.actions ?? [];
      return [
        ...actions
          .filter((action) => editable && !isFile && action.folder === this.item.path)
          .map((action) => ({
            id: `action-${action.id}`,
            title: action.title,
            icon: this.icons.add,
            handler: () => this.requestAction(action),
          })),
        allows('open_source') &&
          isFile &&
          exists && {
            id: 'open_source',
            title: 'Open in Source Code Editor',
            icon: this.icons.codeeditor,
            handler: () => this.openFile(this.item.path, true),
          },
        // Commenting is open to everyone allowed to comment, whatever the file menu rules say
        this.workspacesStore.canComment &&
          isFile &&
          exists && {
            id: 'comment',
            title: 'Comment',
            icon: this.icons.comment,
            handler: () => openCommentDialog(this.$root, this.item.path),
          },
        allows('diff') &&
          isFile &&
          status &&
          exists && {
            id: 'diff',
            title: 'Show Changes',
            icon: this.icons.diff,
            handler: this.requestDiff,
          },
        allows('download') &&
          isFile &&
          exists && {
            id: 'download',
            title: 'Download',
            icon: this.icons.download,
            handler: this.handleDownload,
          },
        allows('revert') &&
          editable &&
          isFile &&
          status &&
          status !== 'added' && {
            id: 'revert',
            title: 'Revert',
            icon: this.icons.revert,
            handler: this.handleRevert,
          },
        allows('create') &&
          editable &&
          !isFile && {
            id: 'create',
            title: 'Create',
            icon: this.icons.add,
            handler: this.requestNewFile,
          },
        // An upload creates files, so it is offered where creating is
        allows('create') &&
          editable &&
          !isFile && {
            id: 'upload',
            title: 'Upload',
            icon: this.icons.upload,
            handler: this.requestUpload,
          },
        allows('rename') &&
          editable &&
          exists && {
            id: 'rename',
            title: 'Rename',
            icon: this.icons.rename,
            handler: this.requestRename,
          },
        allows('delete') &&
          editable &&
          exists && {
            id: 'delete',
            title: 'Delete',
            icon: this.icons.delete,
            color: 'error',
            handler: this.requestDelete,
          },
      ].filter(Boolean);
    },
  },

  methods: {
    // The selected option of the preview that `path` is, or contains, e.g. the folder of a PFS
    async selectedOptionAt(path) {
      const selection = this.workspacesStore.currentWorkspace?.selection ?? [];
      if (selection.length === 0) {
        return null;
      }
      const workspaceId = this.workspacesStore.currentWorkspace.id;
      if (this.workspacesStore.selectionOptions.length === 0) {
        await this.workspacesStore.fetchSelectionOptions(workspaceId);
      }
      return (
        this.workspacesStore.selectionOptions.find(
          (option) =>
            selection.includes(option.id) &&
            option.path &&
            (option.path === path || option.path.startsWith(`${path}/`)),
        ) ?? null
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

    requestAction(action) {
      this.$root.openDialog('ActionDialog', {
        action,
        onAcceptance: async (data) => {
          const result = await this.filesStore.runAction(action.id, data);
          this.notificationsStore.success(`${result.name} created`);
          const open = result.open ?? (result.is_directory ? null : result.path);
          if (open) {
            await this.editorStore.show(open);
          }
        },
      });
    },

    requestUpload() {
      this.$root.openDialog('UploadFilesDialog', { folder: this.item.path });
    },

    async handleCreate({ type, path, name }) {
      await this.filesStore.createFile(path, name, type);
      this.notificationsStore.success(
        `${type === 'folder' ? 'Folder' : 'File'} created successfully`,
      );
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

    async requestDelete() {
      const selected = await this.selectedOptionAt(this.item.path).catch(() => null);
      if (selected) {
        const label = useTypesStore().currentType?.selection?.label ?? 'file';
        this.notificationsStore.warning(
          selected.path === this.item.path
            ? `You can't delete a ${label} that is selected for the preview. Deselect it before deleting.`
            : `You can't delete a folder with a ${label} that is selected for the preview. Deselect it before deleting.`,
        );
        return;
      }

      this.$root.openDialog('DeleteFileDialog', {
        name: this.item.name,
        type: this.item.type,
        path: this.item.path,
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
