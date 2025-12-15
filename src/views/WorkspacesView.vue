<script>
import { useAuthStore } from '@/stores/auth'

export default {
  name: 'WorkspacesView',

  computed: {
    username() {
      const authStore = useAuthStore()
      return authStore.getUsername
    },
  },

  methods: {
    async handleLogout() {
      const authStore = useAuthStore()
      await authStore.logout()
      this.$router.push({ name: 'landing' })
    },
  },
}
</script>

<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title class="d-flex align-center">
            <v-icon start>mdi-folder-multiple</v-icon>
            My Workspaces
            <v-spacer></v-spacer>
            <v-btn color="error" variant="outlined" @click="handleLogout"> Logout </v-btn>
          </v-card-title>
          <v-card-text>
            <v-alert type="success" variant="tonal">
              Welcome, {{ username }}! This is the workspaces page (to be implemented).
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
