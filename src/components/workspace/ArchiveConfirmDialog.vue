<script>
import { mdiClose } from '@mdi/js'

export default {
  name: 'ArchiveConfirmDialog',

  props: {
    modelValue: Boolean,
    workspace: {
      type: Object,
      default: null,
    },
    loading: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['update:modelValue', 'confirm'],

  data() {
    return {
      icons: {
        close: mdiClose,
      },
    }
  },

  computed: {
    showDialog: {
      get() {
        return this.modelValue
      },
      set(value) {
        this.$emit('update:modelValue', value)
      },
    },
  },

  methods: {
    handleConfirm() {
      this.$emit('confirm')
    },

    handleClose() {
      this.showDialog = false
    },
  },
}
</script>

<template>
  <v-dialog v-model="showDialog" max-width="500" persistent>
    <v-card>
      <v-card-title class="d-flex align-center">
        Archive Workspace?
        <v-spacer></v-spacer>
        <v-btn :icon="icons.close" variant="text" @click="handleClose" :disabled="loading"></v-btn>
      </v-card-title>
      <v-card-text>
        <p class="mb-2">Are you sure you want to archive this workspace?</p>
        <v-alert type="warning" variant="tonal" density="compact" class="mt-2">
          <div v-if="workspace?.deletion_at">
            This workspace will be
            <strong
              >permanently deleted on
              {{ new Date(workspace.deletion_at).toLocaleDateString() }}</strong
            >
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
        <v-btn @click="handleClose" :disabled="loading">Cancel</v-btn>
        <v-btn color="warning" :loading="loading" @click="handleConfirm"> Archive </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
