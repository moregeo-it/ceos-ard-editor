<template>
  <div class="changes-overview pa-4 fill-height overflow-auto">
    <h2 class="mb-4">List of Changes</h2>

    <div v-if="proposalStore.isDiffLoading" class="text-center">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <div v-else-if="diffs.length > 0">
      <p class="mb-4">
        Below you can see a list of changes that you have currently stored in your personal
        workspace, but have <strong>not</strong> been sent to the CEOS-ARD GitHub repository yet.
        Please review the changes and provide a summary message before committing them to GitHub.
      </p>
      <v-expansion-panels multiple class="mb-6">
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
      <form @submit.prevent="onCommitMessageSubmit">
        <v-text-field
          v-model="commitMessage"
          persistent-counter
          label="Summary for the changes above"
          variant="outlined"
          :counter="maxLengths.commitMessage"
          :disabled="proposalStore.proposal?.state === 'closed'"
          class="mb-3"
        ></v-text-field>
        <v-btn
          type="submit"
          color="primary"
          :loading="proposalStore.isCommitting"
          :disabled="proposalStore.isCommitting"
          class="w-100"
          >Commit Changes</v-btn
        >
      </form>
    </div>
    <div v-else class="empty-state">
      <p class="text-subtle mt-4">
        No changes have been applied to your workspace.<br />There is nothing to send to GitHub.
      </p>
    </div>
  </div>
</template>

<script>
import { useProposalStore } from '@/stores/proposal';
import { useWorkspacesStore } from '@/stores/workspaces';
import { useNotificationsStore } from '@/stores/notifications';
import FileStatusBadge from '@/components/FileStatusBadge.vue';
import FileDiff from './FileDiff.vue';

export default {
  name: 'ChangeList',

  components: {
    FileStatusBadge,
    FileDiff,
  },

  data() {
    return {
      commits: [],
      commitMessage: '',
      maxLengths: {
        commitMessage: 500,
      },
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

  methods: {
    async onCommitMessageSubmit() {
      try {
        const workspaceId = this.workspacesStore.currentWorkspace.id;
        await this.proposalStore.commitChanges(workspaceId, this.commitMessage);
        this.commitMessage = '';
        this.notificationsStore.success('Commit updated successfully.');
      } catch (error) {
        this.notificationsStore.error('Error updating commit: ' + error.message);
      }
    },
  },
};
</script>
