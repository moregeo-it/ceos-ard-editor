import { defineStore } from 'pinia';

import { useFilesStore } from './files';
const files = useFilesStore();

const getDefaults = () => ({
  opened: [], // Opened files
  data: {}, // Editor data per file path
  active: null, // Currently active file
  isSaving: false,
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
      if (!this.data[path]) {
        this.data[path] = await files.load(path);
      }
    },
    async save(path, content) {
      const file = files.all[path];
      if (!file) {
        return;
      }
      this.data[path] = content;
      await files.save(path, content);
    },
    close(path) {
      const index = this.opened.findIndex((f) => f.path === path);
      if (index !== -1) {
        this.opened.splice(index, 1);
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
