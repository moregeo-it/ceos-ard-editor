<template>
  <v-dialog v-model="show" :max-width="sizes.small">
    <v-card>
      <v-card-title class="d-flex align-center">{{ title }}</v-card-title>
      <v-card-text>{{ message }}</v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn @click="reject">Cancel</v-btn>
        <v-btn
          :color="confirmButtonColor"
          variant="elevated"
          :loading="accepting"
          @click="accept"
          >{{ confirmButton }}</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import DialogMixin from '@/components/DialogMixin';

export default {
  name: 'ConfirmDialog',
  mixins: [DialogMixin],
  props: {
    title: {
      type: String,
      default: 'Confirm',
    },
    message: {
      type: String,
      default: 'Are you sure you want to proceed?',
    },
    confirmButton: {
      type: String,
      default: 'Confirm',
    },
    confirmButtonColor: {
      type: String,
      default: 'primary',
    },
  },
};
</script>
