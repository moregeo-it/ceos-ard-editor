<template>
  <div class="diff-list pa-4 fill-height overflow-auto">
    <h2 class="mb-4">List of Changes</h2>

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
import diffService from '@/services/diff.service';
import { useNotificationsStore } from '@/stores/notifications';
import { useWorkspacesStore } from '@/stores/workspaces';
import FileStatusBadge from '../FileStatusBadge.vue';
import FileDiff from './FileDiff.vue';

export default {
  name: 'DiffList',

  components: {
    FileStatusBadge,
    FileDiff,
  },

  data() {
    return {
      diffs: null,
    };
  },

  computed: {
    workspacesStore() {
      return useWorkspacesStore();
    },
    notificationsStore() {
      return useNotificationsStore();
    },
  },

  async created() {
    try {
      const diffs = await diffService.loadDiffList(this.workspacesStore.currentWorkspace.id);
      this.diffs = diffs.sort((a, b) =>
        a.path.localeCompare(b.path, 'en', { sensitivity: 'base' }),
      );
    } catch (error) {
      this.diffs = [];
      this.notificationsStore.error('Error loading diffs: ' + error.message);
    }
  },
};
</script>
