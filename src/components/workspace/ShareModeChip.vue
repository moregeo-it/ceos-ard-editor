<template>
  <v-chip size="small" variant="tonal" :color="color" :prepend-icon="icon">
    {{ label }}
  </v-chip>
</template>

<script>
import { shareModeLabel, shareModeIcon } from '@/utils/shareMode';

export default {
  name: 'ShareModeChip',

  props: {
    mode: {
      type: String,
      required: true,
    },
    // Card backgrounds are light, so 'primary' tonal reads fine there. The editor header sits on
    // a solid primary app-bar, where a primary-on-primary chip would be invisible - pass 'white'.
    color: {
      type: String,
      default: 'primary',
    },
  },

  computed: {
    label() {
      return shareModeLabel(this.mode);
    },
    icon() {
      return shareModeIcon(this.mode);
    },
  },
};
</script>
