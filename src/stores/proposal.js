import { defineStore } from 'pinia';
import proposalService from '@/services/proposal.service';

import { useWorkspacesStore } from './workspaces';

const getDefaults = () => ({
  diffList: [],
  proposal: null,
  isLoading: false,
  hasUnpersistedChanges: false,
});

export const useProposalStore = defineStore('proposal', {
  state: () => getDefaults(),

  actions: {
    async fetchProposal(workspaceId) {
      this.isLoading = true;
      try {
        const workspacesStore = useWorkspacesStore();
        await workspacesStore.getWorkspace(workspaceId);

        this.proposal = await proposalService.fetchProposal(workspaceId);
      } finally {
        this.isLoading = false;
      }
    },

    async loadDiffList(workspaceId) {
      this.isLoading = true;
      try {
        const diffs = await proposalService.loadDiffList(workspaceId);
        console.log('Diffs loaded:', diffs);
        this.hasUnpersistedChanges = diffs.length > 0;

        this.diffList = diffs.sort((a, b) =>
          a.path.localeCompare(b.path, 'en', { sensitivity: 'base' }),
        );
      } finally {
        this.isLoading = false;
      }
    },

    reset() {
      Object.assign(this, getDefaults());
    },
  },
});
