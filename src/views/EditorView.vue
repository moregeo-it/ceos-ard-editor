<script>
import { useAuthStore } from '@/stores/auth'
import { useWorkspacesStore } from '@/stores/workspaces'
import {
  mdiAccountCircle,
  mdiLogout,
  mdiCheckCircle,
  mdiMenuDown,
  mdiAlertCircle,
  mdiPackageUp,
  mdiClose,
} from '@mdi/js'

export default {
  name: 'EditorView',

  data() {
    return {
      icons: {
        accountCircle: mdiAccountCircle,
        logout: mdiLogout,
        propose: mdiCheckCircle,
        menuDown: mdiMenuDown,
        activate: mdiPackageUp,
        alert: mdiAlertCircle,
        close: mdiClose,
      },
      showUserMenu: false,
      workspace: null,
      loading: true,
      isToggling: false,
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

    isArchived() {
      return this.workspace?.status === 'archived'
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

    async handleToggleStatus() {
      this.isToggling = true
      try {
        await this.workspacesStore.toggleWorkspaceStatus(this.workspaceId)
        // Reload workspace to get updated status
        this.workspace = await this.workspacesStore.getWorkspace(this.workspaceId)
      } catch (error) {
        console.error('Failed to toggle workspace status:', error)
      } finally {
        this.isToggling = false
      }
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
      <!-- Action Buttons -->
      <v-btn
        v-if="!isArchived"
        variant="outlined"
        color="success"
        class="mr-2"
        :prepend-icon="icons.propose"
        @click="handlePropose"
        :disabled="loading"
      >
        Propose
      </v-btn>

      <v-btn
        variant="outlined"
        color="error"
        class="mr-4"
        :prepend-icon="icons.close"
        @click="goToWorkspaces"
      >
        Close
      </v-btn>

      <!-- Workspace Name -->
      <v-app-bar-title>
        {{ workspace?.title || 'Loading...' }}
      </v-app-bar-title>

      <v-spacer />

      <!-- User Menu -->
      <v-menu v-model="showUserMenu" location="bottom end">
        <template v-slot:activator="{ props }">
          <v-btn v-bind="props" variant="text" :prepend-icon="icons.accountCircle">
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
        <!-- Archived Workspace Banner -->
        <v-alert
          v-if="isArchived"
          type="warning"
          variant="tonal"
          prominent
          class="mb-4"
          :icon="icons.alert"
        >
          <v-alert-title>This workspace is archived (Read-Only)</v-alert-title>
          <div class="mt-2">
            You are viewing this workspace in read-only mode.
            <strong>Activate it to make changes or propose updates.</strong>
          </div>
          <template v-if="workspace?.deletion_at">
            <div class="mt-2 text-caption">
              Scheduled for deletion on:
              <strong>{{ new Date(workspace.deletion_at).toLocaleDateString() }}</strong>
            </div>
          </template>
          <template v-slot:append>
            <v-btn
              color="success"
              variant="elevated"
              :prepend-icon="icons.activate"
              @click="handleToggleStatus"
              :loading="isToggling"
            >
              Activate Now
            </v-btn>
          </template>
        </v-alert>

        <!-- Placeholder content - will be replaced with editor -->
        <v-card>
          <v-card-text class="text-center pa-12">
            <v-icon :icon="icons.propose" size="64" color="grey-lighten-1" class="mb-4" />
            <div class="text-h5 text-grey-darken-1 mb-2">Workspace Editor</div>
            <div class="text-body-1 text-grey">Editor content will be implemented here</div>
          </v-card-text>
        </v-card>
      </v-container>
    </v-main>
  </v-app>
</template>
