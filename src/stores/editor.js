import { defineStore } from 'pinia';

import { useFilesStore } from './files';
import { useNotificationsStore } from './notifications';
import { usePreviewStore } from './preview';

const getDefaults = () => ({
  opened: [], // Opened files
  original: {}, // Original data per file path
  data: {}, // Editor data per file path
  changed: {}, // Changed status per file path
  saving: {}, // Saving status per file path
  active: null, // Currently active file
});

export const useEditorStore = defineStore('editor', {
  state: () => getDefaults(),

  getters: {
    hasUnsavedChanges: (state) => {
      return state.opened.some((file) => state.changed[file.path]);
    },
  },

  actions: {
    async show(path) {
      const files = useFilesStore();
      let file = await files.loadFileContext(path);
      if (!file || file.is_directory || file.status === 'deleted') {
        return;
      }
      if (!this.opened.find((f) => f.path === path)) {
        this.opened.push(file);
      }
      this.active = file;
      if (this.original[path] === undefined) {
        const data = await files.load(path);
        this.original[path] = data;
        this.data[path] = data;
        this.changed[path] = false;
        this.saving[path] = false;
      }
    },
    async sync(path, content) {
      this.data[path] = content;
      this.changed[path] = this.original[path] !== content;
    },
    async save(path, regenerate = true) {
      if (!this.changed[path]) {
        return false;
      }
      this.saving[path] = true;
      try {
        const data = this.data[path];
        const files = useFilesStore();
        await files.save(path, data);
        if (regenerate) {
          // Trigger preview regeneration, but don't await it to avoid UI delays
          // and we also don't want to fail on preview errors here
          const previewStore = usePreviewStore();
          previewStore.generatePreview();
        }
        this.original[path] = data;
        this.changed[path] = false;
        return true;
      } catch (error) {
        return error;
      } finally {
        this.saving[path] = false;
      }
    },
    async saveAll() {
      const savePromises = this.opened.map((file) => this.save(file.path, false));
      const results = await Promise.all(savePromises);
      if (results.some((res) => res === true)) {
        // Trigger preview regeneration if at least one file was saved successfully
        // Don't await it to avoid UI delays and we also don't want to fail on preview errors here.
        const previewStore = usePreviewStore();
        previewStore.generatePreview();
      }
      return results;
    },
    close(path) {
      const index = this.opened.findIndex((f) => f.path === path);
      if (index !== -1) {
        this.opened.splice(index, 1);
        delete this.original[path];
        delete this.data[path];
        delete this.changed[path];
      }
      if (this.active && this.active.path === path) {
        // Open the tab on the right, or the last one if there is none
        if (this.opened.length === 0) {
          this.active = null;
        } else if (index < this.opened.length) {
          this.active = this.opened[index];
        } else {
          this.active = this.opened[this.opened.length - 1];
        }
      }
    },

    async onFileCreated(fileData) {
      // Show newly created files (not directories)
      if (fileData && !fileData.is_directory) {
        await this.show(fileData.path);
      }
    },

    /**
     * Handle file deletion from files store.
     * If file has no unsaved changes, close it.
     * Otherwise keep it open and mark it specifically.
     */
    async onFileDeleted(filePath) {
      if (!this.changed[filePath]) {
        await this.close(filePath);
      }
    },

    /**
     * Handle file rename from files store.
     * Updates all editor state from old path to new path.
     */
    async onFileRenamed(oldPath, newFile) {
      const index = this.opened.findIndex((f) => f.path === oldPath);
      if (index === -1) {
        return; // File not open in editor
      }

      const newPath = newFile.path;

      // Update opened files array
      this.opened[index] = newFile;

      // Migrate state from old path to new path
      if (this.original[oldPath] !== undefined) {
        this.original[newPath] = this.original[oldPath];
        delete this.original[oldPath];
      }
      if (this.data[oldPath] !== undefined) {
        this.data[newPath] = this.data[oldPath];
        delete this.data[oldPath];
      }
      if (this.changed[oldPath] !== undefined) {
        this.changed[newPath] = this.changed[oldPath];
        delete this.changed[oldPath];
      }
      if (this.saving[oldPath] !== undefined) {
        this.saving[newPath] = this.saving[oldPath];
        delete this.saving[oldPath];
      }

      // Update active file reference if needed
      if (this.active && this.active.path === oldPath) {
        this.active = newFile;
      }
    },

    /**
     * Handle file revert from files store.
     * Reverts can restore deleted files, undo content changes, and undo renames.
     */
    async onFileReverted(oldPath, revertedFile) {
      const index = this.opened.findIndex((f) => f.path === oldPath);
      if (index === -1) {
        return; // File not open in editor
      }

      // The revert was a rename - update editor state accordingly
      const path = revertedFile.path;
      if (revertedFile.path !== oldPath) {
        await this.onFileRenamed(oldPath, revertedFile);
      } else {
        this.opened[index] = revertedFile;
        // Update active file reference if needed
        if (this.active && this.active.path === path) {
          this.active = revertedFile;
        }
      }

      if (this.changed[path]) {
        return; // File has changes, don't reload content from server
      }

      // Reload the file content from server if the opened file has no unsaved changes
      const files = useFilesStore();
      const data = await files.load(path);
      this.original[path] = data;
      this.data[path] = data;
    },

    reset() {
      Object.assign(this, getDefaults());
    },
  },
});

export function filesEditorSyncPlugin({ store }) {
  if (store.$id !== 'files') {
    return;
  }

  store.$onAction(({ name, args, after }) => {
    const editor = useEditorStore();
    after(async (result) => {
      try {
        switch (name) {
          case 'createFile': {
            await editor.onFileCreated(result);
            break;
          }

          case 'deleteFile': {
            const [filePath] = args;
            await editor.onFileDeleted(filePath);
            break;
          }

          case 'renameFile': {
            const [oldPath] = args;
            if (result && result.path) {
              await editor.onFileRenamed(oldPath, result);
            }
            break;
          }

          case 'revertFile': {
            const [filePath] = args;
            if (result && result.path) {
              await editor.onFileReverted(filePath, result);
            }
            break;
          }
        }
      } catch (error) {
        const notifications = useNotificationsStore();
        notifications.error('Updating editor after file operation failed: ' + error.message);
      }
    });
  });
}
