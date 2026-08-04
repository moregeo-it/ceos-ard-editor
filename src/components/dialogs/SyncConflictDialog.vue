<template>
  <v-dialog v-model="show" :max-width="sizes.medium">
    <v-card>
      <v-card-title>Remote changes conflict</v-card-title>
      <v-card-text>
        <div class="mt-2">
          The branch of this workspace on GitHub was changed in a way that overlaps with the changes
          made in this workspace, so the two versions cannot be combined automatically. You can keep
          working, but new commits cannot be sent to GitHub until the conflict is resolved manually
          on GitHub.
        </div>
        <template v-if="files.length">
          <div class="mt-4 font-weight-medium">Conflicting files:</div>
          <ul class="mt-1 ml-4">
            <li v-for="file of files" :key="file">
              <code>{{ file }}</code>
            </li>
          </ul>
        </template>
        <div class="mt-4">To resolve the conflict:</div>
        <ol class="mt-1 ml-4">
          <li>Review what changed on GitHub with the button below.</li>
          <li>
            Revert the conflicting files in this workspace (right-click the file &rarr; Revert) to
            accept the GitHub version, then commit any remaining changes.
          </li>
          <li>Re-apply your edits to the updated files and commit again.</li>
        </ol>
      </v-card-text>
      <v-card-actions>
        <v-btn color="secondary" :prepend-icon="icons.github" :href="branchUrl" target="_blank">
          Open on GitHub
        </v-btn>
        <v-spacer />
        <v-btn color="primary" @click="reject">Continue</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import DialogMixin from '@/components/DialogMixin';
import { mdiGithub } from '@mdi/js';

export default {
  name: 'SyncConflictDialog',
  mixins: [DialogMixin],
  props: {
    workspace: {
      type: Object,
      required: true,
    },
    files: {
      type: Array,
      default: () => [],
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
    branchUrl() {
      const { fork_repo_owner, fork_repo_name, branch_name } = this.workspace;
      return `https://github.com/${fork_repo_owner}/${fork_repo_name}/tree/${branch_name}`;
    },
  },
};
</script>
