<script>
import { useAuthStore } from '@/stores/auth'
import { useWorkspacesStore } from '@/stores/workspaces'
import {
  mdiAccountCircle,
  mdiLogout,
  mdiArchive,
  mdiCheckCircle,
  mdiMenuDown,
  mdiPackageUp,
  mdiAlertCircle,
  mdiDelete,
  mdiClose,
} from '@mdi/js'

export default {
  name: 'WorkspaceDetailView',

  data() {
    return {
      icons: {
        accountCircle: mdiAccountCircle,
        logout: mdiLogout,
        archive: mdiArchive,
        propose: mdiCheckCircle,
        menuDown: mdiMenuDown,
        activate: mdiPackageUp,
        alert: mdiAlertCircle,
        delete: mdiDelete,
        close: mdiClose,
      },
      showUserMenu: false,
      showDeleteDialog: false,
      isDeleting: false,
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

    confirmDelete() {
      this.showDeleteDialog = true
    },

    async handleDeleteWorkspace() {
      this.isDeleting = true
      try {
        await this.workspacesStore.deleteWorkspace(this.workspaceId)
        // Navigate back to workspaces after successful deletion
        this.$router.push({ name: 'workspaces' })
      } catch (error) {
        console.error('Failed to delete workspace:', error)
      } finally {
        this.isDeleting = false
      }
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
      <v-btn variant="text" class="text-h6 font-weight-medium" @click="goToWorkspaces">
        {{ workspace?.title || 'Loading...' }}
      </v-btn>

      <v-spacer />

      <!-- Action Buttons -->
      <v-btn
        v-if="isArchived"
        variant="outlined"
        color="success"
        class="mr-2"
        :prepend-icon="icons.activate"
        @click="handleToggleStatus"
        :disabled="loading || isToggling"
        :loading="isToggling"
      >
        Activate
      </v-btn>

      <v-btn
        v-if="!isArchived"
        variant="outlined"
        color="warning"
        class="mr-2"
        :prepend-icon="icons.archive"
        @click="handleToggleStatus"
        :disabled="loading || isToggling"
        :loading="isToggling"
      >
        Archive
      </v-btn>

      <v-btn
        variant="outlined"
        color="success"
        class="mr-2"
        :prepend-icon="icons.propose"
        @click="handlePropose"
        :disabled="loading || isArchived"
      >
        Propose
      </v-btn>

      <v-btn
        variant="outlined"
        color="error"
        class="mr-4"
        :prepend-icon="icons.delete"
        @click="confirmDelete"
        :disabled="loading"
      >
        Delete
      </v-btn>

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

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="450" persistent>
      <v-card>
        <v-card-title class="d-flex align-center">
          Delete Workspace?
          <v-spacer></v-spacer>
          <v-btn
            :icon="icons.close"
            variant="text"
            @click="showDeleteDialog = false"
            :disabled="isDeleting"
          ></v-btn>
        </v-card-title>
        <v-card-text>
          <p class="mb-2">
            Are you sure you want to permanently delete <strong>{{ workspace?.title }}</strong
            >?
          </p>
          <v-alert type="error" variant="tonal" density="compact">
            This action cannot be undone. All workspace data will be lost.
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="showDeleteDialog = false" :disabled="isDeleting">Cancel</v-btn>
          <v-btn color="error" :loading="isDeleting" @click="handleDeleteWorkspace">
            Delete Permanently
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<style scoped>
.v-app-bar {
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
</style>
