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

  actions: {
    async show(path) {
      const files = useFilesStore();
      let file = files.all[path];
      if (!file) {
        file = await files.loadFileContext(path);
      }
      if (!file || file.is_directory || file.status === 'deleted') {
        return;
      }
      if (!this.opened.find((f) => f.path === path)) {
        this.opened.push(file);
      }
      this.active = file;
      if (!this.original[path]) {
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
        return;
      }
      const files = useFilesStore();
      const file = files.all[path];
      if (!file) {
        return;
      }
      this.saving[path] = true;
      try {
        const data = this.data[path];
        await files.save(path, data);
        if (regenerate) {
          // Trigger preview regeneration, but don't await it to avoid UI delays
          // and we also don't want to fail on preview errors here
          const previewStore = usePreviewStore();
          previewStore.generatePreview();
        }
        this.original[path] = data;
        this.changed[path] = false;
      } catch (error) {
        const notifications = useNotificationsStore();
        notifications.error(`Failed to save file ${path}: ${error.message}`);
      } finally {
        this.saving[path] = false;
      }
    },
    async saveAll() {
      const savePromises = this.opened.map((file) => this.save(file.path, false));
      await Promise.all(savePromises);
      // Trigger preview regeneration, but don't await it to avoid UI delays
      // and we also don't want to fail on preview errors here
      const previewStore = usePreviewStore();
      previewStore.generatePreview();
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
    reset() {
      Object.assign(this, getDefaults());
    },
  },
});
