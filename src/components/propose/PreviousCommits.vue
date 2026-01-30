<template>
  <div class="previous-commits">
    <div v-if="proposalStore.isCommitsLoading">
      <v-skeleton-loader
        type="list-item-three-line"
        :loading="proposalStore.isCommitsLoading"
        class="mb-2"
        v-for="n in 3"
        :key="n"
      ></v-skeleton-loader>
    </div>
    <v-timeline v-if="proposalStore.commits.length > 0" side="end" class="justify-start">
      <v-timeline-item
        v-for="commit in proposalStore.commits"
        :key="commit.sha"
        size="small"
        width="100%"
      >
        <template #opposite>
          <span class="text-subtle">{{ new Date(commit.timestamp).toLocaleString() }}</span>
        </template>
        <template #default>
          <div class="d-flex justify-space-between">
            <div class="flex-grow-1">{{ commit.message }}</div>
            <div class="text-subtle ml-8">{{ commit.author }}</div>
          </div>
        </template>
      </v-timeline-item>
    </v-timeline>
    <p v-else class="text-subtle">No previous commits available.</p>
  </div>
</template>

<script>
import { useProposalStore } from '@/stores/proposal';

export default {
  name: 'PreviousCommits',
  computed: {
    proposalStore() {
      return useProposalStore();
    },
  },
};
</script>
