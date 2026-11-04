import { defineStore } from 'pinia';
import proposalService from '@/services/proposal.service';

import { useWorkspacesStore } from './workspaces';

import { EVENTS, emit, workspaceSession } from '@/services/events';

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

// This tab's commits, so a refresh that overlapped one doesn't undo it
let localCommits = 0;

const byPath = (diffs) =>
  diffs.sort((a, b) => a.path.localeCompare(b.path, 'en', { sensitivity: 'base' }));

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
    // Without the loading state, so the form keeps its unsaved inputs
    async refreshProposal(workspaceId) {
      const started = workspaceSession();
      const proposal = await proposalService.fetchProposal(workspaceId);
      if (started === workspaceSession()) {
        this.proposal = proposal && Object.keys(proposal).length > 0 ? proposal : null;
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
        this.diffList = byPath(diffs);
      } finally {
        this.isDiffLoading = false;
      }
    },

    /**
     * After changes made elsewhere, e.g. in the owner's other tab: without the loading states, so
     * the page doesn't flicker
     */
    async refreshChanges(workspaceId, { commits = false } = {}) {
      const started = workspaceSession();
      const commitsBefore = localCommits;
      const [diffs, commitList] = await Promise.all([
        proposalService.fetchDiffList(workspaceId),
        commits ? proposalService.fetchCommits(workspaceId) : null,
      ]);
      // A commit of this tab running meanwhile updates both itself
      if (started !== workspaceSession() || commitsBefore !== localCommits || this.isCommitting) {
        return;
      }
      this.diffList = byPath(diffs);
      if (commits) {
        this.commits = Array.isArray(commitList) ? commitList : [];
      }
    },

    async commitChanges(workspaceId, commitMessage) {
      const started = workspaceSession();
      // The pre-commit diff list is exactly what the commit contained ({path, status, source?}).
      const changes = this.diffList;
      localCommits++;
      this.isCommitting = true;
      try {
        const commit = await proposalService.commitChanges(workspaceId, commitMessage);
        if (started !== workspaceSession()) {
          return commit;
        }
        this.commits.unshift(commit);
        this.diffList = [];
        emit(EVENTS.FILE_COMMITTED, { commit, changes });
        return commit;
      } finally {
        if (started === workspaceSession()) {
          this.isCommitting = false;
        }
      }
    },

    reset() {
      Object.assign(this, getDefaults());
    },
  },
});
