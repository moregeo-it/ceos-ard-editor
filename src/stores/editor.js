import { defineStore } from 'pinia';

import { useFilesStore } from './files';
import { useNotificationsStore } from './notifications';
import { usePreviewStore } from './preview';
import { useWorkspacesStore } from './workspaces';
import * as collabService from '@/services/collab.service';
import { supportVisualEditing } from '@/components/ide/editors/utils';

// While a file is edited collaboratively, the client debounce-sends a full-text snapshot to the
// authority, which owns durable persistence (write + git stage). This is more reliable than a
// client-side save because the authority also flushes when the last collaborator leaves.
const SNAPSHOT_DEBOUNCE_MS = 1500;
const snapshotTimers = {};

const getDefaults = () => ({
  opened: [], // Opened files
  original: {}, // Original data per file path
  data: {}, // Editor data per file path
  changed: {}, // Changed status per file path
  saving: {}, // Saving status per file path
  active: null, // Currently active file
  collabDocs: {}, // Live collaboration session per file path (text files on shared workspaces)
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
        this.changed[path] = false;
        this.saving[path] = false;
        return;
      }

      const text = await data.text();
      if (this.isCollabEligible(path)) {
        const connected = await this.connectCollab(path);
        if (connected) {
          // The collab editor renders and syncs its content via @codemirror/collab; `data[path]`
          // is only a defined placeholder so EditorPane mounts the component (Save reads the live
          // document from the session instead).
          const initialDoc = this.collabDocs[path].initialDoc ?? text;
          this.original[path] = initialDoc;
          this.data[path] = initialDoc;
          this.changed[path] = false;
          this.saving[path] = false;
          return;
        }
        // Collab unavailable (server down / didn't init in time) - fall through to plain editing.
      }

      this.original[path] = text;
      this.data[path] = text;
      this.changed[path] = false;
      this.saving[path] = false;
    },

    /**
     * A file is edited collaboratively when the workspace actually has collaborators AND the file
     * renders in the plain-text source editor. The owner connects too (they must see others'
     * edits), hence the `is_shared` check rather than role. The glossary form editor is excluded.
     */
    isCollabEligible(path) {
      const ws = useWorkspacesStore().currentWorkspace;
      if (!ws) {
        return false;
      }
      const isShared = ws.viewer_role !== 'owner' || ws.is_shared === true;
      if (!isShared) {
        return false;
      }
      const file = this.opened.find((f) => f.path === path);
      if (!file) {
        return false;
      }
      if (supportVisualEditing(file) && !file.forceSourceCodeEditor) {
        return false;
      }
      return true;
    },

    /**
     * Open a collaboration session and wait for the authority's initial document. Returns true on
     * success, false if collab isn't available / didn't init in time (then no socket is left open).
     */
    async connectCollab(path, timeoutMs = 8000) {
      if (this.collabDocs[path]) {
        return true;
      }
      const workspaceId = useWorkspacesStore().currentWorkspace?.id;
      if (!workspaceId) {
        return false;
      }
      const session = collabService.connect(workspaceId, path);
      const ready = await Promise.race([
        session.ready.then(() => true),
        new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs)),
      ]);
      if (!ready) {
        collabService.disconnect(session);
        return false;
      }
      session.onResync(() => this.reloadCollab(path));
      this.collabDocs[path] = session;
      return true;
    },

    /**
     * Local edit in collaborative mode: flip the dirty indicator (only local edits call this, not
     * incoming remote ones) and debounce a full-text snapshot to the authority, which persists it.
     */
    markCollabDirty(path) {
      const session = this.collabDocs[path];
      if (!session) {
        return;
      }
      this.changed[path] = true;
      clearTimeout(snapshotTimers[path]);
      snapshotTimers[path] = setTimeout(() => {
        session.sendSnapshot(session.getText());
        // Optimistic: the authority persists the snapshot; clear the "unsaved" indicator.
        this.changed[path] = false;
      }, SNAPSHOT_DEBOUNCE_MS);
    },

    /** Authority desync (reconnect after the room was reset): rebuild the session and editor. */
    async reloadCollab(path) {
      this.disconnectCollab(path);
      this.data[path] = undefined; // unmounts the editor (EditorPane shows a spinner)
      this.original[path] = undefined;
      await this.sync(path);
    },

    disconnectCollab(path) {
      const session = this.collabDocs[path];
      if (!session) {
        return;
      }
      clearTimeout(snapshotTimers[path]);
      delete snapshotTimers[path];
      collabService.disconnect(session);
      delete this.collabDocs[path];
    },

    async applyEdits(path, content) {
      this.data[path] = content;
      this.changed[path] = this.original[path] !== content;
    },
    async save(path, regenerate = true) {
      if (!this.changed[path]) {
        return false;
      }
      this.saving[path] = true;
      try {
        const session = this.collabDocs[path];
        // In collab mode the merged document lives in the editor's collab state, so persist the
        // session's live text; otherwise persist the editor's tracked content.
        const data = session ? session.getText() : this.data[path];
        const files = useFilesStore();
        await files.save(path, data);
        if (regenerate) {
          // Trigger preview regeneration, but don't await it to avoid UI delays
          // and we also don't want to fail on preview errors here
          const previewStore = usePreviewStore();
          // todo: migrate to an event listener system
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
        // todo: migrate to an event listener system
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
        this.disconnectCollab(path);
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

      // The collab session is keyed by path, so the old room no longer applies. Drop it; collab
      // resumes when the file is next opened under its new path.
      this.disconnectCollab(oldPath);

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
      Object.keys(this.collabDocs).forEach((path) => this.disconnectCollab(path));
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

          case 'createNewPfs': {
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
