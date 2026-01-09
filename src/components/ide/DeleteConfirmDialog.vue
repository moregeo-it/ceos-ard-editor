<template>
  <v-dialog v-model="internalShow" max-width="500">
    <v-card>
      <v-card-title class="text-error">
        <v-icon :icon="icons.alert" start color="error"></v-icon>
        Confirm Delete
      </v-card-title>
      <v-card-text>
        <p class="mb-3">
          Are you sure you want to delete <strong>{{ itemName }}</strong
          >?
        </p>
        <v-alert v-if="isFolder" type="warning" variant="tonal" density="compact">
          This will permanently delete the folder and all files inside it.
        </v-alert>
        <v-alert v-else type="info" variant="tonal" density="compact">
          This action cannot be undone.
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="handleCancel">Cancel</v-btn>
        <v-btn color="error" @click="handleDelete" :loading="loading">Delete</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { mdiAlertCircle } from '@mdi/js';

export default {
  name: 'DeleteConfirmDialog',

  props: {
    show: {
      type: Boolean,
      required: true,
    },
    itemName: {
      type: String,
      default: '',
    },
    itemType: {
      type: String,
      default: 'file',
      validator: (value) => ['file', 'folder'].includes(value),
    },
    loading: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['update:show', 'confirm'],

  data() {
    return {
      icons: {
        alert: mdiAlertCircle,
      },
    };
  },

  computed: {
    internalShow: {
      get() {
        return this.show;
      },
      set(value) {
        this.$emit('update:show', value);
      },
    },

    isFolder() {
      return this.itemType === 'folder';
    },
  },

  methods: {
    handleDelete() {
      this.$emit('confirm');
    },

    handleCancel() {
      this.internalShow = false;
    },
  },
};
</script>
