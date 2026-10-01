<template>
  <v-app-bar color="primary" elevation="2">
    <v-app-bar-title>
      <v-icon v-if="icon" :icon="icon" start />
      {{ title }}
    </v-app-bar-title>

    <slot name="central-actions"></slot>

    <v-spacer />

    <div class="d-flex align-center ga-2 mr-4">
      <slot name="actions"></slot>
    </div>

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
};
</script>
