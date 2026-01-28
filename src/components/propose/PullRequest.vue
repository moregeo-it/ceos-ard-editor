<template>
  <div class="pull-request pa-4 fill-height overflow-auto">
    <h2 class="mb-4">Propose Changes</h2>
    <p class="mb-4">
      This will create a "Pull Request" on GitHub where members of CEOS will review your proposed
      changes.
    </p>
    <form @submit.prevent="submitPullRequest">
      <h3 v-if="hasUnpersistedChanges">Summary for the current changes</h3>

      <v-text-field
        v-if="hasUnpersistedChanges"
        v-model="commitMessage"
        required
        label="Summary for this group of unpersisted changes"
        placeholder="Short summary of the changes"
        variant="outlined"
        :disabled="loading"
        :loading="loading"
      ></v-text-field>

      <h3>Proposal</h3>

      <v-text-field
        v-model="title"
        required
        label="Title"
        placeholder="Short title for the pull request"
        variant="outlined"
        :disabled="loading"
        :loading="loading"
      ></v-text-field>

      <v-textarea
        v-model="description"
        required
        label="Description"
        placeholder="Describe the changes you are proposing..."
        hint="You can use Markdown to format your description."
        variant="outlined"
        rows="10"
        :disabled="loading"
        :loading="loading"
      ></v-textarea>

      <v-checkbox v-model="ready" label="Ready for Review" class="mt-2" hide-details />

      <!-- add conditions to buttons -->
      <v-btn
        v-if="state !== 'closed'"
        type="submit"
        color="primary"
        class="mt-2 w-100"
        :disabled="loading"
        :loading="loading"
        >Submit Changes</v-btn
      >
      <v-btn
        v-if="state === 'open'"
        type="button"
        color="error"
        class="mt-2 w-100"
        :disabled="loading"
        :loading="loading"
        >Withdraw Proposal</v-btn
      >
      <v-btn
        v-else-if="state === 'closed'"
        type="button"
        color="info"
        class="mt-2 w-100"
        :disabled="loading"
        :loading="loading"
        >Reopen Proposal</v-btn
      >
    </form>
  </div>
</template>

<script>
import { useProposalStore } from '@/stores/proposal';
import diffService from '@/services/proposal.service';
import { useWorkspacesStore } from '@/stores/workspaces';
import { useNotificationsStore } from '@/stores/notifications';

export default {
  name: 'PullRequest',
  data() {
    return {
      title: '',
      description: '',
      isSubmitting: false,
      commitMessage: '',
      ready: false,
      state: '',
    };
  },
  computed: {
    loading() {
      return (
        this.workspacesStore.isWorkspaceLoading[this.workspaceId] ||
        this.isSubmitting ||
        this.proposalStore.isLoading
      );
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
    proposal() {
      return this.proposalStore.proposal;
    },
    hasUnpersistedChanges() {
      return this.proposalStore.hasUnpersistedChanges;
    },
  },
  watch: {
    proposal: {
      immediate: true,
      handler(newProposal) {
        if (newProposal) {
          this.title = newProposal.title || '';
          this.ready = newProposal.ready || false;
          this.state = newProposal.state || 'open';
          this.description = newProposal.description || '';
        }
      },
    },
  },
  methods: {
    async submitPullRequest() {
      this.isSubmitting = true;
      try {
        const proposalInput = {
          draft: this.ready,
          title: this.title,
          state: this.state,
          description: this.description,
        };

        if (this.hasUnpersistedChanges) {
          proposalInput.commitMessage = this.commitMessage;
        }

        const pr_response = await diffService.createPullRequest(
          this.workspacesStore.currentWorkspace.id,
          proposalInput,
        );

        if (pr_response) {
          this.notificationsStore.success('Pull Request created successfully.');
          this.$router.push({
            name: 'WorkspaceView',
            params: { id: this.workspacesStore.currentWorkspace.id },
          });
        }
      } catch (error) {
        this.notificationsStore.error('Failed to create Pull Request:' + error.message);
      } finally {
        this.isSubmitting = false;
      }
    },
  },
};
</script>
