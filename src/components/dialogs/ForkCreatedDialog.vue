<template>
  <v-dialog v-model="show" :max-width="sizes.medium" persistent>
    <v-card>
      <v-card-title>A CEOS-ARD repository was created on your GitHub account</v-card-title>
      <v-card-text>
        <p class="mb-3">
          Your work is stored in
          <strong>{{ forkFullName }}</strong>
          on your GitHub account, and proposed to CEOS-ARD from there.
        </p>
        <v-alert type="warning" variant="tonal" density="compact" class="mb-3">
          <p class="mb-2 font-weight-bold">Please don't delete this repository on GitHub.</p>
          <p class="mb-0">
            All of your workspaces depend on this repository, so deleting it affects every one of
            them — not just this workspace.
          </p>
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-btn
          :href="forkUrl"
          target="_blank"
          rel="noopener noreferrer"
          :prepend-icon="icons.github"
          color="primary"
        >
          View on GitHub
        </v-btn>
        <v-spacer />
        <v-btn color="primary" variant="flat" @click="reject">Got it</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import DialogMixin from '@/components/DialogMixin';
import { mdiGithub } from '@mdi/js';

export default {
  name: 'ForkCreatedDialog',
  mixins: [DialogMixin],
  props: {
    workspace: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      icons: {
        github: mdiGithub,
      },
    };
  },
  computed: {
    forkFullName() {
      const { fork_repo_owner, fork_repo_name } = this.workspace;
      return `${fork_repo_owner}/${fork_repo_name}`;
    },
    forkUrl() {
      return `https://github.com/${this.forkFullName}`;
    },
  },
};
</script>
