<template>
  <v-app-bar color="primary" elevation="2">
    <v-app-bar-title>
      <v-icon v-if="icon" :icon="icon" start />
      {{ title }}
    </v-app-bar-title>

    <slot name="central-actions"></slot>

    <v-spacer />

    <UserMenu />
  </v-app-bar>
</template>

<script>
import UserMenu from '@/components/workspace/UserMenu.vue';

export default {
  name: 'HeaderBar',
  components: {
    UserMenu,
  },
  props: {
    title: {
      type: String,
      required: true,
    },
    icon: {
      default: null,
    },
  },
  watch: {
    title: {
      immediate: true,
      handler() {
        document.title = this.title || 'CEOS-ARD Editor';
      },
    },
  },
};
</script>
