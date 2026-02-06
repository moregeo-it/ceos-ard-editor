<template>
  <v-dialog v-model="show" :max-width="sizes.medium">
    <v-card>
      <v-card-title class="d-flex align-center"> Archive Workspace? </v-card-title>
      <v-card-text>
        <p class="mb-4">Are you sure you want to archive this workspace?</p>
        <v-alert type="warning" variant="tonal" density="compact" class="mt-2">
          <div v-if="workspace?.deletion_at">
            This workspace will be
            <strong>permanently deleted on {{ date }}</strong>
            unless reactivated before that date.
          </div>
          <div v-else>
            Archived workspaces will be scheduled for automatic deletion after a retention period of
            one month. You can reactivate it anytime before deletion.
          </div>
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn @click="reject">Cancel</v-btn>
        <v-btn color="warning" variant="elevated" :loading="accepting" @click="accept"
          >Archive</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import DialogMixin from '@/components/DialogMixin';

export default {
  name: 'ArchiveConfirmDialog',
  mixins: [DialogMixin],
  props: {
    workspace: {
      type: Object,
      default: null,
    },
  },
  computed: {
    date() {
      if (!this.workspace?.deletion_at) return 'unknown date';
      return new Date(this.workspace.deletion_at).toLocaleDateString();
    },
  },
};
</script>
