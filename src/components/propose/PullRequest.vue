<template>
  <div class="pull-request pa-4 fill-height overflow-auto">
    <h2 class="mb-4">Propose Changes</h2>
    <p class="mb-4">
      This will create a "Pull Request" on GitHub where members of CEOS will review your proposed
      changes.
    </p>
    <form @submit.prevent="submitPullRequest">
      <h3>Summary for the current changes</h3>

      <!-- Hide field if there are no changes -->
      <v-text-field
        v-model="commitMessage"
        required
        label="Summary for this group of unpersisted changes"
        placeholder="Short summary of the changes"
        variant="outlined"
      ></v-text-field>

      <h3>Proposal</h3>

      <v-text-field
        v-model="title"
        required
        label="Title"
        placeholder="Short title for the pull request"
        variant="outlined"
        :disabled="isSubmitting"
        :loading="isSubmitting"
      ></v-text-field>

      <v-textarea
        v-model="description"
        required
        label="Description"
        placeholder="Describe the changes you are proposing..."
        hint="You can use Markdown to format your description."
        variant="outlined"
        rows="10"
        :disabled="isSubmitting"
        :loading="isSubmitting"
      ></v-textarea>

      <v-checkbox v-model="ready" label="Ready for Review" class="mt-2" hide-details />

      <!-- add conditions to buttons -->
      <v-btn
        v-if="serverStatus.state !== 'closed'"
        type="submit"
        color="primary"
        class="mt-2 w-100"
        :disabled="isSubmitting"
        :loading="isSubmitting"
        >Submit Changes</v-btn
      >
      <v-btn
        v-if="serverStatus.state === 'open'"
        type="button"
        color="error"
        class="mt-2 w-100"
        :disabled="isSubmitting"
        :loading="isSubmitting"
        >Withdraw Proposal</v-btn
      >
      <v-btn
        v-else-if="serverStatus.state === 'closed'"
        type="button"
        color="info"
        class="mt-2 w-100"
        :disabled="isSubmitting"
        :loading="isSubmitting"
        >Reopen Proposal</v-btn
      >
    </form>
  </div>
</template>

<script>
import diffService from '@/services/diff.service';
import { useWorkspacesStore } from '@/stores/workspaces';
import { useNotificationsStore } from '@/stores/notifications';

export default {
  name: 'PullRequest',
  data() {
    return {
      serverStatus: {
        state: 'closed',
      },
      title: '',
      description: '',
      isSubmitting: false,
      commitMessage: '',
      ready: false,
      state: 'open',
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
  methods: {
    async submitPullRequest() {
      this.isSubmitting = true;
      try {
        const pr_response = await diffService.createPullRequest(
          this.workspacesStore.currentWorkspace.id,
          this.title,
          this.description,
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
