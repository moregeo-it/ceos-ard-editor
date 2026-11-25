<template>
  <div class="d-flex align-center flex-wrap gap-2">
    <template v-if="hasItems">
      <v-chip
        v-for="(item, index) in items"
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
  name: 'SelectionBadges',

  props: {
    // The workspace's selection, e.g. PFS ids
    items: {
      type: Array,
      default: () => [],
    },
  },

  computed: {
    hasItems() {
      return this.items && this.items.length > 0;
    },
  },
};
</script>
