<template>
  <v-app-bar :color="color" elevation="2">
    <v-app-bar-title tag="h1">
      <v-icon v-if="icon" :icon="icon" start />
      {{ title }}
      <v-chip v-if="subtitle" size="small" variant="outlined" class="ms-2">
        {{ subtitle }}
      </v-chip>
    </v-app-bar-title>

    <slot name="central-actions"></slot>

    <v-spacer />

    <v-defaults-provider :defaults="{ VBtn: { height: 48 } }">
      <div class="d-flex align-center ga-2 mr-4">
        <slot name="actions"></slot>
      </div>

      <UserMenu />
    </v-defaults-provider>
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
    // E.g. the workspace type, shown next to the title
    subtitle: {
      type: String,
      default: null,
    },
    color: {
      type: String,
      default: 'primary',
    },
  },
};
</script>
