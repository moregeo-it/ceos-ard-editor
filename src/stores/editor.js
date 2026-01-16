import { defineStore } from 'pinia';

import { useFilesStore } from './files';
const files = useFilesStore();

import { useNotificationsStore } from './notifications';
const notifications = useNotificationsStore();

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
      const file = files.all[path];
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
    async save(path) {
      if (!this.changed[path]) {
        return;
      }
      const file = files.all[path];
      if (!file) {
        return;
      }
      this.saving[path] = true;
      try {
        const data = this.data[path];
        await files.save(path, data);
        this.original[path] = data;
        this.changed[path] = false;
      } catch (error) {
        notifications.error(`Failed to save file ${path}: ${error.message}`);
      } finally {
        this.saving[path] = false;
      }
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
