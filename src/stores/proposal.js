import { defineStore } from 'pinia';
import proposalService from '@/services/proposal.service';

import { useWorkspacesStore } from './workspaces';

import { EVENTS, emit } from '@/services/events';

const getDefaults = () => ({
  diffList: [],
  proposal: null,
  commits: [],
  expandedFiles: [],
  // Loading states
  isProposalLoading: false,
  isDiffLoading: false,
  isCommitListLoading: false,
  isCommitting: false,
  // Form inputs
  commitMessage: '',
  prTitle: null,
  prDescription: null,
});

export const useProposalStore = defineStore('proposal', {
  state: () => getDefaults(),

  actions: {
    updateProposal(proposal) {
      this.proposal = proposal;
    },
    async fetchProposal(workspaceId) {
      this.isProposalLoading = true;
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
        this.isProposalLoading = false;
      }
    },
    async fetchCommits(workspaceId) {
      this.isCommitListLoading = true;
      try {
        const workspacesStore = useWorkspacesStore();
        await workspacesStore.getWorkspace(workspaceId);

        const commits = await proposalService.fetchCommits(workspaceId);
        if (Array.isArray(commits)) {
          this.commits = commits;
        } else {
          this.commits = [];
        }
      } finally {
        this.isCommitListLoading = false;
      }
    },

    async fetchDiffList(workspaceId) {
      this.isDiffLoading = true;
      try {
        const diffs = await proposalService.fetchDiffList(workspaceId);
        this.diffList = diffs.sort((a, b) =>
          a.path.localeCompare(b.path, 'en', { sensitivity: 'base' }),
        );
      } finally {
        this.isDiffLoading = false;
      }
    },

    async commitChanges(workspaceId, commitMessage) {
      this.isCommitting = true;
      try {
        const commit = await proposalService.commitChanges(workspaceId, commitMessage);
        // The pre-commit diff list is exactly what the commit contained ({path, status, source?}).
        const changes = this.diffList;
        this.commits.unshift(commit);
        this.diffList = [];
        emit(EVENTS.FILE_COMMITTED, { commit, changes });
        return commit;
      } finally {
        this.isCommitting = false;
      }
    },

    reset() {
      Object.assign(this, getDefaults());
    },
  },
});
