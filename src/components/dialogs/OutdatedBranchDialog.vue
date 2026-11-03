<template>
  <v-dialog v-model="show" :max-width="sizes.medium">
    <v-card>
      <v-card-title>{{ conflicts ? 'Conflicts with CEOS-ARD' : 'Behind CEOS-ARD' }}</v-card-title>
      <v-card-text>
        <div class="mt-2">
          The official CEOS-ARD repository has {{ commits }} that this workspace doesn't have yet.
          <template v-if="conflicts">
            Its changes touch the same parts of these files as this workspace, so your proposal
            can't be merged until the conflicts are resolved:
          </template>
          <template v-else>Its changes don't conflict with the ones made here.</template>
        </div>
        <ul v-if="conflicts" class="mt-2 ml-4">
          <li v-for="file of upstream.conflicting_files" :key="file">
            <code>{{ file }}</code>
          </li>
        </ul>
        <div class="mt-4">
          Updating the workspace isn't possible in the editor yet. On GitHub,
          {{ workspace.pull_request_number ? 'open' : 'once your changes are proposed, open' }}
          the pull request and use "{{ conflicts ? 'Resolve conflicts' : 'Update branch' }}". The
          changes then arrive here the next time you open this workspace.
        </div>
      </v-card-text>
      <v-card-actions>
        <v-btn color="secondary" :prepend-icon="icons.github" :href="branchUrl" target="_blank">
          Open on GitHub
        </v-btn>
        <v-spacer />
        <v-btn color="primary" @click="reject">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import DialogMixin from '@/components/DialogMixin';
import { mdiGithub } from '@mdi/js';

export default {
  name: 'OutdatedBranchDialog',
  mixins: [DialogMixin],
  props: {
    workspace: {
      type: Object,
      required: true,
    },
    // The sync's comparison with ceos-org/ceos-ard
    upstream: {
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
    conflicts() {
      return this.upstream.conflicting_files.length > 0;
    },
    commits() {
      const count = this.upstream.behind_commits;
      return count === 1 ? '1 new commit' : `${count} new commits`;
    },
    branchUrl() {
      const { fork_repo_owner, fork_repo_name, branch_name } = this.workspace;
      return `https://github.com/${fork_repo_owner}/${fork_repo_name}/tree/${branch_name}`;
    },
  },
};
</script>
