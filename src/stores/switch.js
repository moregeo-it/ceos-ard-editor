import { defineStore } from 'pinia';

const getDefaults = () => ({
  view: 'editor', // 'editor' or 'propose'
});

export const useSwitchStore = defineStore('switch', {
  state: () => getDefaults(),
  actions: {
    reset() {
      Object.assign(this, getDefaults());
    },
  },
});
