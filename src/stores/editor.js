import { defineStore } from 'pinia';

import { useFilesStore } from './files';

import { EVENTS, on } from '@/services/events';

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
    async show(path, forceSourceCodeEditor = false) {
      if (typeof path !== 'string' || path.length === 0) {
        return;
      }
      const files = useFilesStore();
      if (!path.startsWith('/')) {
        console.warn('File path should start with /. Prepending it automatically.');
        path = '/' + path;
      }
      let file = await files.loadFileContext(path);
      if (!file || file.is_directory || file.status === 'deleted') {
        return;
      }
      if (!this.opened.find((f) => f.path === path)) {
        file = Object.assign({}, file);
        if (forceSourceCodeEditor) {
          file.forceSourceCodeEditor = true;
        }
        this.opened.push(file);
      }
      this.active = file;
      if (this.original[path] === undefined) {
        await this.sync(path);
      }
    },
    async sync(path) {
      if (!this.opened.find((f) => f.path === path)) {
        return;
      }
      const files = useFilesStore();
      const data = await files.load(path);
      if (data.type.startsWith('image/') || data.type === 'application/pdf') {
        this.original[path] = data;
        this.data[path] = data;
      } else {
        const text = await data.text();
        this.original[path] = text;
        this.data[path] = text;
      }
      this.changed[path] = false;
      this.saving[path] = false;
    },
    async applyEdits(path, content) {
      this.data[path] = content;
      this.changed[path] = this.original[path] !== content;
    },
    async save(path) {
      if (!this.changed[path]) {
        return false;
      }
      this.saving[path] = true;
      try {
        const data = this.data[path];
        const files = useFilesStore();
        // Preview regeneration happens via the `file.saved` event files.save() emits.
        await files.save(path, data);
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
      const savePromises = this.opened.map((file) => this.save(file.path));
      return await Promise.all(savePromises);
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
     * Close a deleted file's tab only when it has no local unsaved changes.
     * A dirty tab is kept open so the user can close it themselves via the
     * tab's close button, which warns before discarding changes.
     */
    closeUnchangedFile(filePath) {
      if (!this.changed[filePath]) {
        return this.close(filePath);
      }
    },

    /**
     * React to a deleted file. Close its tab if there are no unsaved changes;
     * otherwise keep it open (regardless of whether the delete is revertible)
     * so the user closes it themselves via the tab's close button.
     */
    async onFileDeleted(filePath) {
      await this.closeUnchangedFile(filePath);
    },

    /**
     * React to a deleted folder. Close every clean open tab underneath it;
     * tabs with unsaved changes stay open for the user to close manually.
     */
    async onFolderDeleted(folderPath) {
      const prefix = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
      const openUnderFolder = this.opened.filter((f) => f.path.startsWith(prefix));
      for (const file of openUnderFolder) {
        await this.closeUnchangedFile(file.path);
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

      // Reload the file content from server. Use sync() so text blobs are decoded to strings -
      // assigning the raw Blob would make the editor treat a text file as an unsupported type.
      await this.sync(path);
    },

    reset() {
      Object.assign(this, getDefaults());
    },
  },
});

let listenersRegistered = false;

/**
 * React to workspace events with editor follow-ups (tabs, open-file state). Self-contained:
 * reads only the event payload and editor state, never the files tree.
 */
export function registerEditorEventListeners() {
  if (listenersRegistered) {
    return;
  }
  listenersRegistered = true;

  on(EVENTS.FILE_CREATED, async (event) => {
    // Only open a tab for files this user created - viewers shouldn't get tabs opened by others.
    if (event.source === 'local') {
      await useEditorStore().onFileCreated(event.file);
    }
  });

  on(EVENTS.FILE_SAVED, async (event) => {
    // A local save already holds the content; only remote saves need a re-sync of the open tab.
    if (event.source === 'remote') {
      await useEditorStore().sync(event.path); // no-op if the file isn't open
    }
  });

  on(EVENTS.FILE_DELETED, async (event) => {
    const editor = useEditorStore();
    if (event.file?.is_directory) {
      await editor.onFolderDeleted(event.path);
    } else {
      await editor.onFileDeleted(event.path);
    }
  });

  on(EVENTS.FILE_RENAMED, async (event) => {
    if (event.file?.path) {
      await useEditorStore().onFileRenamed(event.old_path ?? event.path, event.file);
    }
  });

  on(EVENTS.FILE_REVERTED, async (event) => {
    if (event.file?.path) {
      await useEditorStore().onFileReverted(event.old_path ?? event.path, event.file);
    }
  });
}
