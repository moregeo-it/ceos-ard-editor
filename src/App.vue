<script>
import { useNotificationsStore } from '@/stores/notifications'

export default {
  name: 'App',

  computed: {
    notificationsStore() {
      return useNotificationsStore()
    },

    snackbarColor() {
      const colors = {
        success: 'success',
        error: 'error',
        warning: 'warning',
        info: 'info',
      }
      return colors[this.notificationsStore.type] || 'info'
    },
  },
}
</script>

<template>
  <v-app>
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
  </v-app>
</template>
