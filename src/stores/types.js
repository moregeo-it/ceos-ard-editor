import { defineStore } from 'pinia';

import { useWorkspacesStore } from './workspaces';
import workspaceService from '@/services/workspace.service';

export const useTypesStore = defineStore('types', {
  state: () => ({
    types: [],
    isLoaded: false,
  }),

  getters: {
    byId: (state) => (id) => state.types.find((type) => type.id === id) ?? null,

    // The types offered for new workspaces; the others are listed for their existing workspaces
    availableTypes: (state) => state.types.filter((type) => type.available),

    currentType() {
      const workspace = useWorkspacesStore().currentWorkspace;
      return workspace ? this.byId(workspace.type) : null;
    },

    hasMultipleTypes() {
      return this.availableTypes.length > 1;
    },

    // The name of what the workspace's repository holds, e.g. CEOS-ARD, or the chosen repository
    projectName() {
      return (workspace) => {
        const type = workspace ? this.byId(workspace.type) : null;
        return type?.choose_repository ? workspace.upstream_repo : type?.title;
      };
    },
  },

  actions: {
    async fetchTypes(force = false) {
      if (this.isLoaded && !force) {
        return this.types;
      }
      this.types = await workspaceService.fetchTypes();
      this.isLoaded = true;
      return this.types;
    },
  },
});
