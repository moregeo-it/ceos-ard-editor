<template>
  <v-dialog scrollable v-model="show" width="90%" height="90%">
    <v-card>
      <v-card-title>Changes</v-card-title>
      <v-card-text>
        <FileDiff :file="item" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" @click="show = false">OK</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import FileDiff from '@/components/propose/FileDiff.vue';

export default {
  name: 'DiffDialog',

  components: {
    FileDiff,
  },

  emits: ['close'],

  data() {
    return {
      show: true,
    };
  },

  watch: {
    show(newVal) {
      if (!newVal) {
        this.$emit('close');
      }
    },
  },

  props: {
    item: {
      type: Object,
      required: true,
    },
  },
};
</script>
