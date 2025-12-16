<script>
import { useAuthStore } from '@/stores/auth'
import { useWorkspacesStore } from '@/stores/workspaces'
import { mdiAccountCircle, mdiLogout, mdiArchive, mdiCheckCircle, mdiMenuDown } from '@mdi/js'

export default {
  name: 'WorkspaceView',

  data() {
    return {
      icons: {
        accountCircle: mdiAccountCircle,
        logout: mdiLogout,
        archive: mdiArchive,
        propose: mdiCheckCircle,
        menuDown: mdiMenuDown,
      },
      showUserMenu: false,
      workspace: null,
      loading: true,
    }
  },

  computed: {
    authStore() {
      return useAuthStore()
    },

    workspacesStore() {
      return useWorkspacesStore()
    },

    workspaceId() {
      return this.$route.params.id
    },
  },

  async mounted() {
    await this.loadWorkspace()
  },

  methods: {
    async loadWorkspace() {
      try {
        this.loading = true
        this.workspace = await this.workspacesStore.getWorkspace(this.workspaceId)
      } catch (error) {
        console.error('Failed to load workspace:', error)
        this.$router.push({ name: 'workspaces' })
      } finally {
        this.loading = false
      }
    },

    handleArchive() {
      // TODO: Implement archive functionality
      console.log('Archive workspace:', this.workspaceId)
    },

    handlePropose() {
      // TODO: Implement propose functionality
      console.log('Propose workspace:', this.workspaceId)
    },

    async handleLogout() {
      await this.authStore.logout()
      this.$router.push({ name: 'landing' })
    },

    goToWorkspaces() {
      this.$router.push({ name: 'workspaces' })
    },
  },
}
</script>

<template>
  <v-app>
    <!-- Top Navigation Bar -->
    <v-app-bar color="primary" elevation="2">
      <!-- Workspace Name -->
      <v-btn
        variant="text"
        class="text-h6 font-weight-medium"
        @click="goToWorkspaces"
      >
        {{ workspace?.title || 'Loading...' }}
      </v-btn>

      <v-spacer />

      <!-- Action Buttons -->
      <v-btn
        variant="outlined"
        color="error"
        class="mr-2"
        :prepend-icon="icons.archive"
        @click="handleArchive"
        :disabled="loading"
      >
        Archive
      </v-btn>

      <v-btn
        variant="outlined"
        color="success"
        class="mr-4"
        :prepend-icon="icons.propose"
        @click="handlePropose"
        :disabled="loading"
      >
        Propose
      </v-btn>

      <!-- User Menu -->
      <v-menu v-model="showUserMenu" location="bottom end">
        <template v-slot:activator="{ props }">
          <v-btn
            v-bind="props"
            variant="text"
            :prepend-icon="icons.accountCircle"
          >
            {{ authStore.username }}
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
    </v-app-bar>

    <!-- Main Content Area -->
    <v-main>
      <v-container v-if="loading" class="fill-height d-flex align-center justify-center">
        <v-progress-circular indeterminate color="primary" size="64" />
      </v-container>

      <v-container v-else fluid class="pa-6">
        <!-- Placeholder content - will be replaced with editor -->
        <v-card>
          <v-card-text class="text-center pa-12">
            <v-icon :icon="icons.propose" size="64" color="grey-lighten-1" class="mb-4" />
            <div class="text-h5 text-grey-darken-1 mb-2">
              Workspace Editor
            </div>
            <div class="text-body-1 text-grey">
              Editor content will be implemented here
            </div>
          </v-card-text>
        </v-card>
      </v-container>
    </v-main>
  </v-app>
</template>

<style scoped>
.v-app-bar {
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
</style>
