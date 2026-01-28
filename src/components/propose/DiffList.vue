<template>
  <div class="diff-list pa-4 fill-height overflow-auto">
    <template v-if="commits.length > 0">
      <h2>List of Commits</h2>

      <p>
        This is a list of previous changes that have been persisted as commits on GitHub in a Pull
        Request.
      </p>

      <ul>
        <li v-for="file in commits" :key="file.path">...</li>
      </ul>
    </template>

    <h2 class="mb-4">List of Changes</h2>

    <p>Lists all changes that have been made recently and still need to be committed to GitHub.</p>

    <div v-if="diffs === null" class="text-center">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <div v-else-if="diffs.length > 0">
      <v-expansion-panels multiple>
        <v-expansion-panel v-for="file in diffs" :key="file.path">
          <v-expansion-panel-title>
            <FileStatusBadge :status="file.status" class="mr-2" width="60px" />
            <template v-if="file.source">{{ file.source }} → </template>
            {{ file.path }}
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <FileDiff :file="file" />
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </div>

    <div v-else class="empty-state text-center">
      <p class="text-subtle mt-2">No changes found</p>
    </div>
  </div>
</template>

<script>
import { useProposalStore } from '@/stores/proposal';
import { useWorkspacesStore } from '@/stores/workspaces';
import { useNotificationsStore } from '@/stores/notifications';
import FileStatusBadge from '@/components/FileStatusBadge.vue';
import FileDiff from '@/components/propose/FileDiff.vue';

export default {
  name: 'DiffList',

  components: {
    FileStatusBadge,
    FileDiff,
  },

  data() {
    return {
      commits: [],
    };
  },

  computed: {
    workspacesStore() {
      return useWorkspacesStore();
    },
    notificationsStore() {
      return useNotificationsStore();
    },
    proposalStore() {
      return useProposalStore();
    },
    diffs() {
      return this.proposalStore.diffList;
    },
  },

  async created() {
    try {
      await this.proposalStore.loadDiffList(this.workspacesStore.currentWorkspace.id);
    } catch (error) {
      this.notificationsStore.error('Error loading diffs: ' + error.message);
    }
  },
};
</script>
