<template>
  <v-menu v-model="showMenu" location="bottom end">
    <template v-slot:activator="{ props }">
      <v-btn v-bind="props" variant="text" :prepend-icon="icons.accountCircle">
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
  },

  methods: {
    async handleLogout() {
      try {
        await this.authStore.logout();
        this.notificationsStore.success('Successfully logged out');
        this.$router.push({ name: 'landing' });
      } catch {
        // Even if logout fails on backend, we still clear local auth
        // Just notify user there might have been an issue
        if (this.authStore.error) {
          this.notificationsStore.warning('Logged out locally. Server logout may have failed.');
        }
        this.$router.push({ name: 'landing' });
      }
    },
  },
};
</script>
