<template>
  <v-menu v-model="showMenu" location="bottom end">
    <template v-slot:activator="{ props }">
      <v-btn v-bind="props" variant="text">
        <template v-slot:prepend>
          <v-avatar v-if="avatarUrl" size="35" class="user-avatar">
            <v-img :src="avatarUrl" alt="" />
          </v-avatar>
          <v-icon v-else :icon="icons.accountCircle" />
        </template>
        {{ username }}
        <v-icon :icon="icons.menuDown" />
      </v-btn>
    </template>

    <v-list>
      <v-list-item @click="handleLogout">
        <template v-slot:prepend>
          <v-icon :icon="icons.logout" />
        </template>
        <v-list-item-title>Logout</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script>
import { useAuthStore } from '@/stores/auth';
import { useNotificationsStore } from '@/stores/notifications';
import { githubAvatarUrl } from '@/utils/avatars';
import { mdiAccountCircle, mdiMenuDown, mdiLogout } from '@mdi/js';

export default {
  name: 'UserMenu',

  data() {
    return {
      icons: {
        accountCircle: mdiAccountCircle,
        menuDown: mdiMenuDown,
        logout: mdiLogout,
      },
      showMenu: false,
    };
  },

  computed: {
    authStore() {
      return useAuthStore();
    },

    notificationsStore() {
      return useNotificationsStore();
    },

    username() {
      return this.authStore.username || 'User';
    },

    // Until a session stored by an older editor is confirmed, which adds it
    avatarUrl() {
      return this.authStore.githubId ? githubAvatarUrl(this.authStore.githubId) : null;
    },
  },

  methods: {
    async handleLogout() {
      try {
        await this.authStore.logout();
        this.notificationsStore.success('Successfully logged out');
      } catch {
        this.notificationsStore.error('Logout failed, you are still logged in. Please try again.');
      }
    },
  },
};
</script>
