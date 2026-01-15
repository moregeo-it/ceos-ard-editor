<template>
  <v-dialog v-model="show" max-width="500">
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
          <strong>{{ new Date(workspace.deletion_at).toLocaleDateString() }}</strong>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-btn color="success" :prepend-icon="icons.activate" @click="activate"
          >Reactivate Workspace</v-btn
        >
        <v-spacer />
        <v-btn color="primary" :prepend-icon="icons.eye" @click="close">View Workspace</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { mdiEye, mdiPackageUp } from '@mdi/js';

export default {
  name: 'ArchivedDialog',

  props: {
    workspace: {
      type: Object,
      required: true,
    },
  },

  data() {
    return {
      show: true,
      icons: {
        eye: mdiEye,
        activate: mdiPackageUp,
      },
    };
  },

  emits: ['activate', 'update:show'],

  methods: {
    activate() {
      this.$emit('activate', this.workspace);
      this.show = false;
    },

    close() {
      this.show = false;
    },
  },
};
</script>
