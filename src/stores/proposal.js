import { defineStore } from 'pinia';
import proposalService from '@/services/proposal.service';

import { useWorkspacesStore } from './workspaces';

const getDefaults = () => ({
  diffList: [],
  proposal: null,
  isLoading: false,
});

export const useProposalStore = defineStore('proposal', {
  state: () => getDefaults(),

  actions: {
    async fetchProposal(workspaceId) {
      this.isLoading = true;
      try {
        const workspacesStore = useWorkspacesStore();
        await workspacesStore.getWorkspace(workspaceId);

        const proposal = await proposalService.fetchProposal(workspaceId);

        if (proposal && Object.keys(proposal).length > 0) {
          this.proposal = proposal;
        } else {
          this.proposal = null;
        }
      } finally {
        this.isLoading = false;
      }
    },

    async loadDiffList(workspaceId) {
      this.isLoading = true;
      try {
        const diffs = await proposalService.loadDiffList(workspaceId);
        this.diffList = diffs.sort((a, b) =>
          a.path.localeCompare(b.path, 'en', { sensitivity: 'base' }),
        );
      } finally {
        this.isLoading = false;
      }
    },

    async commitChanges(workspaceId, commitMessage) {
      this.isLoading = true;
      try {
        const commit = await proposalService.commitChanges(workspaceId, commitMessage);

        this.proposal.commits.push(commit);
        return commit;
      } finally {
        this.isLoading = false;
      }
    },

    reset() {
      Object.assign(this, getDefaults());
    },
  },
});
