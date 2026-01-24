<template>
  <v-app v-if="workspace" id="propose">
    <HeaderBar :title="workspace.title" :icon="icons.title">
      <template #central-actions>
        <HeaderSwitch />
      </template>
    </HeaderBar>

    <!-- Main Content Area -->
    <v-main>
      <splitpanes @resized="storePaneSizes" :dbl-click-splitter="false">
        <pane class="diff" min-size="20" :size="panelSizes.diff">
          <DiffList />
        </pane>
        <pane class="pr" min-size="20" :size="panelSizes.pr">
          <PullRequest />
        </pane>
      </splitpanes>
    </v-main>
  </v-app>
  <v-container v-else class="fill-height d-flex align-center justify-center">
    <v-progress-circular indeterminate color="primary" size="64" />
  </v-container>
</template>

<script>
import { useNotificationsStore } from '@/stores/notifications';
import { useWorkspacesStore } from '@/stores/workspaces';
import { mdiCheckCircle } from '@mdi/js';
import { Splitpanes, Pane } from 'splitpanes';
import HeaderBar from '@/components/HeaderBar.vue';
import HeaderSwitch from '@/components/HeaderSwitch.vue';
import DiffList from '@/components/propose/DiffList.vue';
import PullRequest from '@/components/propose/PullRequest.vue';

export default {
  name: 'ProposeView',
  components: {
    DiffList,
    HeaderBar,
    HeaderSwitch,
    Pane,
    PullRequest,
    Splitpanes,
  },
  data() {
    const panelSizeDefaults = {
      diff: 60,
      pr: 40,
    };
    return {
      icons: {
        title: mdiCheckCircle,
      },
      panelSizeDefaults: panelSizeDefaults,
      panelSizes: {
        diff: localStorage.diffPanelSize ?? panelSizeDefaults.diff,
        pr: localStorage.prPanelSize ?? panelSizeDefaults.pr,
      },
    };
  },

  computed: {
    loading() {
      return this.workspacesStore.isWorkspaceLoading[this.workspaceId];
    },
    workspace() {
      return this.workspacesStore.currentWorkspace;
    },
    workspaceId() {
      return this.$route.params.id;
    },
    isArchived() {
      return this.workspace?.status === 'archived';
    },
    workspacesStore() {
      return useWorkspacesStore();
    },
    notificationsStore() {
      return useNotificationsStore();
    },
  },

  async created() {
    await this.loadWorkspace();
  },

  methods: {
    storePaneSizes: ({ panes }) => {
      if (panes.length === 2) {
        localStorage.diffPanelSize = panes[0].size;
        localStorage.prPanelSize = panes[1].size;
      }
    },

    async loadWorkspace() {
      try {
        await this.workspacesStore.getWorkspace(this.workspaceId);
      } catch (error) {
        this.notificationsStore.error(`Failed to load workspace: ${error.message}`);
        this.$router.push({ name: 'workspaces' });
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
.diff,
.pr {
  max-height: 100%;
  overflow: hidden;
}
</style>
