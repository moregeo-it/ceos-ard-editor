<template>
  <div class="pull-request pa-4 fill-height overflow-auto">
    <h2 class="mb-4">
      <template v-if="proposal">Update Proposal</template>
      <template v-else>Create Proposal</template>
    </h2>

    <div v-if="isLoading" class="text-center">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <template v-else-if="proposal">
      <p class="mb-2">
        You already submitted some changes to the CEOS-ARD GitHub repository. The
        <em>Pull Request</em> can be found here:
      </p>

      <v-btn :href="proposal.html_url" target="_blank" color="primary" class="mb-4 w-100"
        >View Pull Request on GitHub</v-btn
      >

      <form @submit.prevent="submitPullRequest" v-if="proposal.state !== 'merged'">
        <template v-if="diffs.length > 0">
          <v-text-field
            v-model="commitMessage"
            persistent-hint
            label="Summary for the current changes"
            hint="Please provide a summary for the changes that you are proposing in this update."
            variant="outlined"
            :counter="maxLengths.commitMessage"
            :disabled="proposal.state === 'closed'"
            class="mb-6"
          ></v-text-field>
        </template>

        <v-checkbox
          v-model="ready"
          persistent-hint
          label="Ready for Review"
          :hint="readyHint"
          :disabled="proposal.state === 'closed'"
          class="mb-9"
        />

        <v-expansion-panels class="mb-4">
          <v-expansion-panel>
            <v-expansion-panel-title>
              (Optional) You can also update the title and description of the overall proposal.
            </v-expansion-panel-title>
            <v-expansion-panel-text>
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
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>

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

        <v-checkbox
          v-model="ready"
          persistent-hint
          label="Ready for Review"
          :hint="readyHint"
          class="mb-9"
        />

        <template v-if="diffs.length > 0">
          <v-text-field
            v-model="commitMessage"
            persistent-hint
            label="Summary for the current changes"
            hint="(Optional) Please provide a summary for the current changes that you are proposing. If not provided, the title of the proposal will be used."
            variant="outlined"
            :counter="maxLengths.commitMessage"
            class="mb-6"
          ></v-text-field>
        </template>

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
      maxLengths: {
        title: 200,
        description: 10000,
        commitMessage: 500,
      },
      readyHint:
        'Please indicate whether this proposal is ready for review. In this case member of CEOS-ARD will be notified to review your changes. Otherwise, it will be created as a draft proposal and you can continue to add more changes later.',
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
          this.ready = newProposal.ready || false;
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
          description: this.description,
        };

        if (this.diffs && this.diffs.length > 0) {
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
