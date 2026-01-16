<template>
  <v-btn
    block
    size="x-large"
    :color="buttonConfig.color"
    :prepend-icon="buttonConfig.icon"
    :loading="loading"
    elevation="2"
    class="text-none"
    @click="$emit('click')"
  >
    <span :style="{ color: buttonConfig.textColor }">
      {{ buttonConfig.label }}
    </span>
  </v-btn>
</template>

<script>
import { mdiGithub, mdiGoogle } from '@mdi/js';

export default {
  name: 'LoginButton',

  props: {
    provider: {
      type: String,
      required: true,
      validator: (value) => ['github', 'google'].includes(value),
    },
    loading: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['click'],

  computed: {
    buttonConfig() {
      const configs = {
        github: {
          label: 'Continue with GitHub',
          icon: mdiGithub,
          color: '#24292e',
          textColor: 'white',
        },
        google: {
          label: 'Continue with Google',
          icon: mdiGoogle,
          color: '#4285F4',
          textColor: 'white',
        },
      };
      return configs[this.provider];
    },
  },
};
</script>
