<template>
  <template v-if="workspace">
    <HeaderBar :title="workspace.title" :icon="icons.title">
      <template #central-actions>
        <HeaderSwitch />
      </template>
    </HeaderBar>

    <!-- Main Content Area -->
    <v-main class="main-with-header">
      <v-container v-if="loading" class="fill-height d-flex align-center justify-center">
        <v-progress-circular indeterminate color="primary" size="64" />
      </v-container>
      <splitpanes v-else @resized="storePaneSizes" :dbl-click-splitter="false">
        <pane class="changes" min-size="20" :size="panelSizes.changes">
          <ChangeList />
        </pane>
        <pane class="pr" min-size="20" :size="panelSizes.pr">
          <PullRequest />
        </pane>
      </splitpanes>
    </v-main>
  </template>
  <v-container v-else class="fill-height d-flex align-center justify-center">
    <v-progress-circular indeterminate color="primary" size="64" />
  </v-container>
</template>

<script>
import { useNotificationsStore } from '@/stores/notifications';
import { useWorkspacesStore } from '@/stores/workspaces';
import { useProposalStore } from '@/stores/proposal';
import { useRealtimeStore } from '@/stores/realtime';
import { EVENTS, on } from '@/services/events';

import { mdiCheckCircle } from '@mdi/js';
import { Splitpanes, Pane } from 'splitpanes';
import HeaderBar from '@/components/HeaderBar.vue';
import HeaderSwitch from '@/components/HeaderSwitch.vue';
import ChangeList from '@/components/propose/ChangeList.vue';
import PullRequest from '@/components/propose/PullRequest.vue';

// Changes made elsewhere that also add commits
const COMMIT_EVENTS = [EVENTS.FILE_COMMITTED, EVENTS.WORKSPACE_SYNCED, EVENTS.REALTIME_RESYNCED];

export default {
  name: 'ProposeView',
  components: {
    ChangeList,
    HeaderBar,
    HeaderSwitch,
    Pane,
    PullRequest,
    Splitpanes,
  },
  data() {
    const panelSizeDefaults = {
      changes: 60,
      pr: 40,
    };
    return {
      icons: {
        title: mdiCheckCircle,
      },
      panelSizeDefaults: panelSizeDefaults,
      panelSizes: {
        changes: localStorage.changesPanelSize ?? panelSizeDefaults.changes,
        pr: localStorage.prPanelSize ?? panelSizeDefaults.pr,
      },
      unmounted: false,
    };
  },

  computed: {
    loading() {
      return (
        this.workspacesStore.isWorkspaceLoading[this.workspaceId] ||
        this.proposalStore.isProposalLoading
      );
    },
    workspace() {
      return this.workspacesStore.currentWorkspace;
    },
    workspaceId() {
      return this.$route.params.id;
    },
    workspacesStore() {
      return useWorkspacesStore();
    },
    notificationsStore() {
      return useNotificationsStore();
    },
    proposalStore() {
      return useProposalStore();
    },
  },

  async created() {
    this.workspacesStore.enterWorkspace(this.workspaceId);
    // The Propose view is owner-only - collaborators (any share mode) never see it, not even read-only.
    try {
      await this.workspacesStore.getWorkspace(this.workspaceId);
    } catch (error) {
      if (this.unmounted) {
        return;
      }
      this.notificationsStore.error(`Failed to load workspace: ${error.message}`);
      this.$router.push({ name: 'workspaces' });
      return;
    }
    if (this.unmounted) {
      return;
    }

    if (!this.workspacesStore.isOwner) {
      this.notificationsStore.error('Only the workspace owner can propose changes.');
      this.$router.push({ name: 'editor', params: { id: this.workspaceId } });
      return;
    }

    this.loadProposal();
    this.proposalStore.fetchDiffList(this.workspaceId).catch((error) => {
      this.notificationsStore.error(`Failed to load list of changes: ${error.message}`);
    });
    this.proposalStore.fetchCommits(this.workspaceId).catch((error) => {
      this.notificationsStore.error(`Failed to load commits: ${error.message}`);
    });

    useRealtimeStore().connect(this.workspaceId);
    this.stopListening = [
      ...['file.*', EVENTS.WORKSPACE_SYNCED, EVENTS.REALTIME_RESYNCED].map((pattern) =>
        on(pattern, this.changedElsewhere),
      ),
      // Opened or changed in the owner's other tab
      on(EVENTS.PROPOSAL_UPDATED, (event) => this.proposalStore.updateProposal(event.proposal)),
      // An update missed while disconnected
      on(EVENTS.REALTIME_RESYNCED, () =>
        this.proposalStore
          .refreshProposal(this.workspaceId)
          .catch((error) => console.error('Error refreshing the proposal:', error)),
      ),
    ];
  },

  beforeUnmount() {
    this.unmounted = true;
    this.stopListening?.forEach((stop) => stop());
    clearTimeout(this.refreshTimer);
  },

  methods: {
    storePaneSizes: ({ panes }) => {
      if (panes.length === 2) {
        localStorage.changesPanelSize = panes[0].size;
        localStorage.prPanelSize = panes[1].size;
      }
    },

    // A burst of changes, such as saving all files in another tab, refreshes once
    changedElsewhere(event) {
      if (event.source !== 'remote' && event.type !== EVENTS.REALTIME_RESYNCED) {
        return;
      }
      this.refreshCommits ||= COMMIT_EVENTS.includes(event.type);
      clearTimeout(this.refreshTimer);
      this.refreshTimer = setTimeout(() => {
        const commits = this.refreshCommits;
        this.refreshCommits = false;
        this.proposalStore
          .refreshChanges(this.workspaceId, { commits })
          .catch((error) => console.error('Error refreshing the changes:', error));
      }, 300);
    },

    async loadProposal() {
      try {
        await this.proposalStore.fetchProposal(this.workspaceId);
      } catch (error) {
        this.notificationsStore.error(`Failed to load workspace proposal: ${error.message}`);
        this.$router.push({ name: 'workspaces', params: { id: this.workspaceId } });
      }
    },
  },
};
</script>

<style>
@import '../../node_modules/splitpanes/dist/splitpanes.css';
@import './split.css';
</style>

<style scoped>
.changes,
.pr {
  max-height: 100%;
  overflow: hidden;
}
</style>
