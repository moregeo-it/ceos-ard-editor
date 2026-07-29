<template>
  <v-chip size="small" :prepend-icon="icon">
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
