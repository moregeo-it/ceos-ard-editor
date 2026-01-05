<script>
import { mdiClose } from '@mdi/js'

export default {
  name: 'DeleteConfirmDialog',

  props: {
    modelValue: Boolean,
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
  <v-dialog v-model="showDialog" max-width="400" persistent>
    <v-card>
      <v-card-title class="d-flex align-center">
        Delete Workspace?
        <v-spacer></v-spacer>
        <v-btn :icon="icons.close" variant="text" @click="handleClose" :disabled="loading"></v-btn>
      </v-card-title>
      <v-card-text>
        Are you sure you want to permanently delete this workspace? This action cannot be undone.
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn @click="handleClose" :disabled="loading">Cancel</v-btn>
        <v-btn color="error" :loading="loading" @click="handleConfirm"> Delete Permanently </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
