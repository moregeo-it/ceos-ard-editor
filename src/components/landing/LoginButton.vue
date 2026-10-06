<template>
  <v-btn
    block
    size="x-large"
    color="#24292e"
    :prepend-icon="icons.github"
    :loading="loading"
    elevation="2"
    class="text-none"
    @click="$emit('click')"
  >
    <span class="text-white">Continue with GitHub</span>
  </v-btn>
</template>

<script>
import { mdiGithub } from '@mdi/js';

export default {
  name: 'LoginButton',

  props: {
    loading: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['click'],

  data() {
    return {
      icons: { github: mdiGithub },
    };
  },
};
</script>
