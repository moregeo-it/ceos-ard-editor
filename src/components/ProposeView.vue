<template>
  <splitpanes @resized="storePaneSizes" :dbl-click-splitter="false">
    <pane class="changes" min-size="20" :size="panelSizes.changes">
      <ChangeList />
    </pane>
    <pane class="pr" min-size="20" :size="panelSizes.pr">
      <PullRequest />
    </pane>
  </splitpanes>
</template>

<script>
import { useNotificationsStore } from '@/stores/notifications';
import { useWorkspacesStore } from '@/stores/workspaces';
import { useProposalStore } from '@/stores/proposal';

import { mdiCheckCircle } from '@mdi/js';
import { Splitpanes, Pane } from 'splitpanes';
import ChangeList from '@/components/propose/ChangeList.vue';
import PullRequest from '@/components/propose/PullRequest.vue';

export default {
  name: 'ProposeView',
  components: {
    ChangeList,
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
    };
  },

  computed: {
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

  created() {
    this.loadProposal();
    this.proposalStore.fetchDiffList(this.workspaceId).catch((error) => {
      this.notificationsStore.error(`Failed to load list of changes: ${error.message}`);
    });
    this.proposalStore.fetchCommits(this.workspaceId).catch((error) => {
      this.notificationsStore.error(`Failed to load commits: ${error.message}`);
    });
  },

  methods: {
    storePaneSizes: ({ panes }) => {
      if (panes.length === 2) {
        localStorage.changesPanelSize = panes[0].size;
        localStorage.prPanelSize = panes[1].size;
      }
    },

    async loadProposal() {
      try {
        await this.proposalStore.fetchProposal(this.workspaceId);
      } catch (error) {
        this.notificationsStore.error(`Failed to load workspace proposal: ${error.message}`);
        //this.$router.push({ name: 'workspaces', params: { id: this.workspaceId } });
      }
    },
  },
};
</script>

<style>
@import '../../node_modules/splitpanes/dist/splitpanes.css';
@import './split.css';

#propose,
#propose > * {
  height: 100vh !important;
}
#propose .v-main {
  height: calc(100vh - var(--v-layout-top)) !important;
}
</style>

<style scoped>
.changes,
.pr {
  max-height: 100%;
  overflow: hidden;
}
</style>
