<template>
  <div class="pull-request pa-4 fill-height overflow-auto">
    <h2 class="mb-4">Propose Changes</h2>
    <p class="mb-4">
      This will create a "Pull Request" on GitHub where members of CEOS will review your proposed
      changes.
    </p>
    <form @submit.prevent="submitPullRequest">
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

      <v-btn
        type="submit"
        color="primary"
        class="mt-2 w-100"
        :disabled="isSubmitting"
        :loading="isSubmitting"
        >Submit</v-btn
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
      title: '',
      description: '',
      isSubmitting: false,
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
