<template>
  <div class="d-flex align-center flex-wrap gap-2">
    <template v-if="hasPfs">
      <v-chip
        v-for="(item, index) in pfs"
        :key="index"
        size="small"
        color="info"
        variant="flat"
        class="me-1"
      >
        {{ item }}
      </v-chip>
    </template>
  </div>
</template>

<script>
export default {
  name: 'PfsBadges',

  props: {
    pfs: {
      type: Array,
      default: () => [],
    },
  },

  computed: {
    hasPfs() {
      return this.pfs && this.pfs.length > 0;
    },
  },
};
</script>
