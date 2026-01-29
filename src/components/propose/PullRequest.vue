<template>
  <div class="pull-request pa-4 fill-height overflow-auto">
    <div class="d-flex align-center mb-4">
      <h2 class="mr-3 mb-0">
        <template v-if="proposal">Update Proposal</template>
        <template v-else>Create Proposal</template>
      </h2>
      <v-badge
        v-if="proposal && proposal.draft"
        color="grey"
        content="Draft"
        class="ml-2"
        bordered
      />
    </div>

    <div v-if="isLoading" class="text-center">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <template v-else-if="proposal">
      <v-alert type="info" class="mb-4" border="start" color="primary" variant="tonal" dense>
        You already submitted some changes to the CEOS-ARD GitHub repository.
      </v-alert>

      <form @submit.prevent="submitPullRequest" v-if="proposal.state !== 'merged'">
        <v-text-field
          v-model="title"
          required
          persistent-hint
          label="Title of the Proposal"
          hint="You can update the title for your overall proposal."
          variant="outlined"
          :counter="maxLengths.title"
          :disabled="proposal.state === 'closed'"
          class="mb-6"
        ></v-text-field>

        <v-textarea
          v-model="description"
          required
          persistent-hint
          label="Description of the Proposal"
          hint="You can update the detailed description of your overall proposal. You can use Markdown to format your description."
          variant="outlined"
          rows="8"
          :counter="maxLengths.description"
          :disabled="proposal.state === 'closed'"
          class="mb-4"
        ></v-textarea>

        <v-btn :href="proposal.url" target="_blank" color="primary" class="mb-4 w-100"
          >View Pull Request on GitHub</v-btn
        >

        <previous-commits class="mb-6" />

        <v-btn
          v-if="!proposal.state || proposal.state === 'open'"
          type="submit"
          color="primary"
          class="mt-2 w-100"
          :disabled="isSubmitting"
          :loading="isSubmitting"
        >
          Update Proposal
        </v-btn>
        <v-btn
          v-if="proposal.state === 'open'"
          type="button"
          color="error"
          class="mt-2 w-100"
          :disabled="isSubmitting"
          :loading="isSubmitting"
          >Withdraw Proposal</v-btn
        >
        <v-btn
          v-else-if="proposal.state === 'closed'"
          type="button"
          color="info"
          class="mt-2 w-100"
          :disabled="isSubmitting"
          :loading="isSubmitting"
          >Reopen Proposal</v-btn
        >
      </form>
    </template>

    <template v-else-if="diffs.length > 0">
      <p class="mb-4">
        You can propose your changes to CEOS-ARD now. This will create a new
        <em>Pull Request</em> on the CEOS-ARD GitHub repository. You can add more changes to the
        <em>Pull Request</em> later as well.
      </p>

      <form @submit.prevent="submitPullRequest">
        <v-text-field
          v-model="title"
          required
          persistent-hint
          label="Title of the Proposal"
          hint="Please provide a summarizing title for your overall proposal."
          variant="outlined"
          :counter="maxLengths.title"
          class="mb-6"
        ></v-text-field>

        <v-textarea
          v-model="description"
          required
          persistent-hint
          label="Description of the Proposal"
          hint="Please provide a detailed description of your overall proposal. You can use Markdown to format your description."
          variant="outlined"
          rows="8"
          :counter="maxLengths.description"
          class="mb-4"
        ></v-textarea>

        <v-btn
          type="submit"
          color="primary"
          class="w-100"
          :loading="isSubmitting"
          :disabled="isSubmitting"
        >
          Create Proposal
        </v-btn>
      </form>
    </template>

    <p v-else>
      You currently have no changes to propose. Please make some changes in your personal workspace
      first.
    </p>
  </div>
</template>

<script>
import PreviousCommits from './PreviousCommits.vue';
import { useProposalStore } from '@/stores/proposal';
import diffService from '@/services/proposal.service';
import { useWorkspacesStore } from '@/stores/workspaces';
import { useNotificationsStore } from '@/stores/notifications';

export default {
  name: 'PullRequest',
  components: {
    PreviousCommits,
  },
  data() {
    return {
      title: '',
      description: '',
      isSubmitting: false,
      maxLengths: {
        title: 200,
        description: 10000,
      },
    };
  },
  computed: {
    isLoading() {
      const workspaceId = this.workspacesStore.currentWorkspace?.id;
      return this.workspacesStore.isWorkspaceLoading[workspaceId] || this.proposalStore.isLoading;
    },
    workspace() {
      return this.workspacesStore.currentWorkspace;
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
    diffs() {
      return this.proposalStore.diffList;
    },
  },
  watch: {
    title: {
      handler(newTitle, oldTitle) {
        if (!this.commitMessage || this.commitMessage === oldTitle) {
          this.commitMessage = newTitle;
        }
      },
    },
    workspace: {
      immediate: true,
      handler(workspace) {
        if (workspace && !this.proposal) {
          this.title = workspace.title || '';
          this.description = workspace.description || '';
        }
      },
    },
    proposal: {
      immediate: true,
      handler(newProposal) {
        if (newProposal) {
          this.title = newProposal.title || '';
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
          title: this.title,
          description: this.description,
        };

        if (this.diffs && this.diffs.length > 0 && this.commitMessage !== '') {
          proposalInput.commitMessage = this.commitMessage;
        }

        const pr_response = await diffService.createPullRequest(
          this.workspacesStore.currentWorkspace.id,
          proposalInput,
        );

        if (pr_response) {
          this.notificationsStore.success('Pull Request created successfully.');
        }
      } catch (error) {
        this.notificationsStore.error('Failed to create Pull Request: ' + error.message);
      } finally {
        this.isSubmitting = false;
      }
    },
  },
};
</script>
