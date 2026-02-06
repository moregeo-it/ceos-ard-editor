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
  },
  data() {
    return {
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
};
</script>
