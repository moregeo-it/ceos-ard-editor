<template>
  <v-chip size="small" :color="color" variant="flat">
    <div :style="styles">{{ status }}</div>
  </v-chip>
</template>

<script>
export default {
  name: 'FileStatusBadge',

  props: {
    status: {
      type: String,
      required: true,
    },
    width: {
      type: String,
      default: 'auto',
    },
  },

  computed: {
    styles() {
      if (this.width !== 'auto') {
        return {
          width: this.width,
          'text-align': 'center',
        };
      }
      return {};
    },
    color() {
      switch (this.status) {
        case 'added':
          return 'green';
        case 'modified':
          return 'blue';
        case 'deleted':
          return 'red';
        default:
          return 'grey';
      }
    },
  },
};
</script>
