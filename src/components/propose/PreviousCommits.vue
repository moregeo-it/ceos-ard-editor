<template>
  <div v-if="proposalStore.proposal" class="pa-4">
    <h3 class="mb-4">Previous Commits</h3>
    <div v-if="isLoading">
      <v-skeleton-loader
        type="list-item-three-line"
        :loading="isLoading"
        class="mb-2"
        v-for="n in 3"
        :key="n"
      ></v-skeleton-loader>
    </div>
    <div v-else>
      <v-list v-if="commits.length > 0">
        <v-list-item
          v-for="commit in commits"
          :key="commit.sha"
          :href="commit.url"
          target="_blank"
          rel="noopener"
        >
          <v-list-item-title class="font-weight-medium">
            {{ commit.message }}
          </v-list-item-title>
        </v-list-item>
      </v-list>
      <p v-else class="text-subtle">No previous commits found.</p>
    </div>
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
    isLoading() {
      return this.proposalStore.isLoading;
    },
    commits() {
      return this.proposalStore.proposal?.commits || [];
    },
  },
};
</script>
