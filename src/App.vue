<template>
  <v-app id="app">
    <router-view />

    <!-- Global Snackbar -->
    <v-snackbar
      v-model="notificationsStore.show"
      :color="snackbarColor"
      :timeout="notificationsStore.timeout"
      location="bottom end"
      multi-line
    >
      {{ notificationsStore.message }}
      <template v-slot:actions>
        <v-btn color="white" variant="outlined" @click="notificationsStore.hide()"> Close </v-btn>
      </template>
    </v-snackbar>

    <DialogControl ref="dialogs" />
  </v-app>
</template>

<script>
import { useNotificationsStore } from '@/stores/notifications';
import { useAuthStore } from '@/stores/auth';
import DialogControl from '@/components/DialogControl.vue';

export default {
  name: 'App',

  components: {
    DialogControl,
  },

  computed: {
    notificationsStore() {
      return useNotificationsStore();
    },

    authStore() {
      return useAuthStore();
    },

    snackbarColor() {
      const colors = {
        success: 'success',
        error: 'error',
        warning: 'warning',
        info: 'info',
      };
      return colors[this.notificationsStore.type] || 'info';
    },
  },

  watch: {
    'authStore.isPendingReauth'(needsReauth) {
      if (needsReauth) {
        this.openDialog('ReauthenticationDialog', {
          show: true,
        });
      } else {
        this.closeDialog('ReauthenticationDialog');
      }
    },
  },

  methods: {
    // Returns a callback to close the dialog
    openDialog(component, props = {}, events = {}) {
      if (this.$refs.dialogs) {
        return this.$refs.dialogs.open(component, props, events);
      }
    },
    closeDialog(component) {
      if (this.$refs.dialogs) {
        this.$refs.dialogs.close(component);
      }
    },
  },
};
</script>

<style>
:root {
  --ceos-primary: #3e5265;
}
#app,
#app > * {
  height: 100vh !important;
}
.main-with-header {
  height: calc(100vh - var(--v-layout-top)) !important;
}
.text-subtle {
  color: rgba(0, 0, 0, 0.6);
}

@media (prefers-color-scheme: dark) {
  .text-subtle {
    color: rgba(255, 255, 255, 0.6);
  }
}
</style>
