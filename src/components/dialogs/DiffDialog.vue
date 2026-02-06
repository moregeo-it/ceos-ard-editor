<template>
  <v-dialog scrollable v-model="show" :width="sizes.large" :height="sizes.large">
    <v-card>
      <v-card-title>Changes</v-card-title>
      <v-card-text>
        <FileDiff :file="item" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" @click="reject" variant="elevated">OK</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import FileDiff from '@/components/propose/FileDiff.vue';
import DialogMixin from '@/components/DialogMixin';

export default {
  name: 'DiffDialog',
  mixins: [DialogMixin],
  components: {
    FileDiff,
  },
  props: {
    item: {
      type: Object,
      required: true,
    },
  },
};
</script>
