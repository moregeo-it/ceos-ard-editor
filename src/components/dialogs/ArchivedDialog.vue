<template>
  <v-dialog v-model="show" :max-width="sizes.medium">
    <v-card>
      <v-card-title>Archived Workspace (read-only)</v-card-title>
      <v-card-text>
        <div class="mt-2">
          This workspace has been archived, either manually by you or automatically due to the PR
          being merged or closed. You can view the contents in read-only mode or you can reactivate
          the workspace to regain full editing capabilities if the PR has not been merged yet.
        </div>
        <div v-if="workspace.deletion_at" class="mt-2 text-caption">
          The workspace is scheduled for deletion on:
          <strong>{{ date }}</strong>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-btn color="success" :prepend-icon="icons.activate" @click="accept">
          Reactivate Workspace
        </v-btn>
        <v-spacer />
        <v-btn color="primary" :prepend-icon="icons.eye" @click="reject">View Workspace</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import DialogMixin from '@/components/DialogMixin';
import { mdiEye, mdiPackageUp } from '@mdi/js';

export default {
  name: 'ArchivedDialog',
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
        eye: mdiEye,
        activate: mdiPackageUp,
      },
    };
  },
  computed: {
    date() {
      if (!this.workspace?.deletion_at) return 'unknown date';
      return new Date(this.workspace.deletion_at).toLocaleDateString();
    },
  },
};
</script>
