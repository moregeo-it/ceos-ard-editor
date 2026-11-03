<template>
  <v-dialog v-model="show" :max-width="sizes.medium">
    <v-card>
      <v-card-title class="text-error">
        <v-icon :icon="icons.alert" start color="error"></v-icon>
        Confirm Delete
      </v-card-title>
      <v-card-text>
        <p class="mb-3">
          Are you sure you want to delete <strong>{{ name }}</strong
          >?
        </p>
        <v-alert
          v-if="usage.length > 0"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          Used in {{ usage.join(', ') }}.
        </v-alert>
        <v-alert v-if="isFolder" type="warning" variant="tonal" density="compact">
          This will delete the folder and all files inside it. If under version control, the
          deletion can be reverted. For files that are not under version control, the delete is
          permanent.
        </v-alert>
        <v-alert v-else type="info" variant="tonal" density="compact">
          This will delete the selected file. If under version control, the deletion can be
          reverted. For files that are not under version control, the delete is permanent.
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="reject">Cancel</v-btn>
        <v-btn color="error" @click="accept" :loading="accepting" variant="elevated">Delete</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import DialogMixin from '@/components/DialogMixin';
import fileService from '@/services/file.service';
import { useWorkspacesStore } from '@/stores/workspaces';
import { mdiAlertCircle } from '@mdi/js';

export default {
  name: 'DeleteFileDialog',
  mixins: [DialogMixin],
  props: {
    name: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      default: 'file',
      validator: (value) => ['file', 'folder'].includes(value),
    },
    path: {
      type: String,
      default: null,
    },
  },
  data() {
    return {
      // The PFS that use the file, e.g. for a requirement
      usage: [],
      icons: {
        alert: mdiAlertCircle,
      },
    };
  },
  computed: {
    isFolder() {
      return this.type === 'folder';
    },
  },
  async created() {
    if (this.isFolder || !this.path) {
      return;
    }
    try {
      // Not through the files store, which would write a late response over a deleted or renamed file
      const workspaceId = useWorkspacesStore().currentWorkspace?.id;
      this.usage = (await fileService.loadFileContext(workspaceId, this.path))?.usage ?? [];
    } catch {
      // The usage is only a hint, deleting works without it
    }
  },
};
</script>
