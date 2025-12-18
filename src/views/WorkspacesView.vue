<script>
import { useAuthStore } from '@/stores/auth'
import { useWorkspacesStore } from '@/stores/workspaces'
import WorkspaceCard from '@/components/workspace/WorkspaceCard.vue'
import WorkspaceDialog from '@/components/workspace/WorkspaceDialog.vue'
import ArchiveConfirmDialog from '@/components/workspace/ArchiveConfirmDialog.vue'
import DeleteConfirmDialog from '@/components/workspace/DeleteConfirmDialog.vue'
import {
  mdiFolderMultiple,
  mdiAccountCircle,
  mdiLogout,
  mdiPlus,
  mdiFolderOff,
  mdiMenuDown,
  mdiClose,
} from '@mdi/js'

export default {
  name: 'WorkspacesView',

  components: {
    WorkspaceCard,
    WorkspaceDialog,
    ArchiveConfirmDialog,
    DeleteConfirmDialog,
  },

  data() {
    return {
      icons: {
        folderMultiple: mdiFolderMultiple,
        accountCircle: mdiAccountCircle,
        logout: mdiLogout,
        plus: mdiPlus,
        folderOff: mdiFolderOff,
        menuDown: mdiMenuDown,
        close: mdiClose,
      },
      showWorkspaceDialog: false,
      workspaceDialogMode: 'create',
      workspaceToEdit: null,
      showUserMenu: false,
      isSubmitting: false,
      showArchiveDialog: false,
      workspaceToArchive: null,
      showDeleteDialog: false,
      workspaceToDelete: null,
      isDeleting: false,
      isTogglingStatus: false,
      filter: 'all', // 'all', 'active', 'archived'
    }
  },

  computed: {
    authStore() {
      return useAuthStore()
    },

    workspacesStore() {
      return useWorkspacesStore()
    },

    username() {
      return this.authStore.getUsername
    },

    filteredWorkspaces() {
      const store = this.workspacesStore

      switch (this.filter) {
        case 'active':
          return store.activeWorkspaces
        case 'archived':
          return store.archivedWorkspaces
        default:
          return store.workspaces
      }
    },
  },

  async mounted() {
    await this.loadData()
  },

  methods: {
    async loadData() {
      try {
        await Promise.all([this.workspacesStore.fetchWorkspaces(), this.workspacesStore.fetchPfs()])
      } catch (error) {
        console.error('Failed to load data:', error)
      }
    },

    openCreateDialog() {
      this.workspaceDialogMode = 'create'
      this.workspaceToEdit = null
      this.showWorkspaceDialog = true
    },

    async handleWorkspaceSubmit(workspaceData) {
      this.isSubmitting = true
      try {
        if (this.workspaceDialogMode === 'create') {
          await this.workspacesStore.createWorkspace(workspaceData)
        } else {
          await this.workspacesStore.updateWorkspace(workspaceData.id, {
            title: workspaceData.title,
            pfs: workspaceData.pfs,
            description: workspaceData.description,
          })
        }
        this.showWorkspaceDialog = false
        this.workspaceToEdit = null
      } catch (error) {
        console.error('Failed to save workspace:', error)
      } finally {
        this.isSubmitting = false
      }
    },

    handleViewWorkspace(workspaceId) {
      this.$router.push({
        name: 'editor',
        params: { id: workspaceId },
      })
    },

    handleEditWorkspace(workspaceId) {
      const workspace = this.workspacesStore.workspaces.find((w) => w.id === workspaceId)
      if (workspace) {
        this.workspaceDialogMode = 'update'
        this.workspaceToEdit = workspace
        this.showWorkspaceDialog = true
      }
    },

    async handleToggleStatus(workspaceId) {
      const workspace = this.workspacesStore.workspaces.find((w) => w.id === workspaceId)

      // If workspace is active, show archive confirmation dialog
      if (workspace?.status === 'active') {
        this.workspaceToArchive = workspaceId
        this.showArchiveDialog = true
      } else {
        // If workspace is archived, reactivate immediately without confirmation
        this.isTogglingStatus = true
        try {
          await this.workspacesStore.toggleWorkspaceStatus(workspaceId)
        } catch (error) {
          console.error('Failed to reactivate workspace:', error)
        } finally {
          this.isTogglingStatus = false
        }
      }
    },

    async handleArchiveWorkspace() {
      this.isTogglingStatus = true
      try {
        await this.workspacesStore.toggleWorkspaceStatus(this.workspaceToArchive)
        this.showArchiveDialog = false
        this.workspaceToArchive = null
      } catch (error) {
        console.error('Failed to archive workspace:', error)
      } finally {
        this.isTogglingStatus = false
      }
    },

    confirmDelete(workspaceId) {
      this.workspaceToDelete = workspaceId
      this.showDeleteDialog = true
    },

    async handleDeleteWorkspace() {
      this.isDeleting = true
      try {
        await this.workspacesStore.deleteWorkspace(this.workspaceToDelete)
        this.showDeleteDialog = false
        this.workspaceToDelete = null
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
  },
}
</script>

<template>
  <v-app>
    <!-- App Bar -->
    <v-app-bar color="primary" elevation="2">
      <v-app-bar-title>
        <v-icon :icon="icons.folderMultiple" start></v-icon>
        My Workspaces
      </v-app-bar-title>

      <v-spacer></v-spacer>

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

    <!-- Main Content -->
    <v-main>
      <v-container>
        <!-- Toolbar -->
        <v-row class="mb-4">
          <v-col cols="12" md="6">
            <v-btn
              color="primary"
              size="large"
              :prepend-icon="icons.plus"
              @click="openCreateDialog"
            >
              Create Workspace
            </v-btn>
          </v-col>

          <v-col cols="12" md="6" class="d-flex justify-end align-center">
            <v-btn-toggle v-model="filter" variant="outlined" divided mandatory>
              <v-btn value="all">
                All
                <v-chip size="x-small" class="ml-2">
                  {{ workspacesStore.workspaces.length }}
                </v-chip>
              </v-btn>
              <v-btn value="active">
                Active
                <v-chip size="x-small" class="ml-2" color="success">
                  {{ workspacesStore.activeWorkspaces.length }}
                </v-chip>
              </v-btn>
              <v-btn value="archived">
                Archived
                <v-chip size="x-small" class="ml-2" color="grey">
                  {{ workspacesStore.archivedWorkspaces.length }}
                </v-chip>
              </v-btn>
            </v-btn-toggle>
          </v-col>
        </v-row>

        <!-- Loading State -->
        <v-row v-if="workspacesStore.isLoading">
          <v-col v-for="n in 3" :key="n" cols="12" md="4">
            <v-skeleton-loader type="card"></v-skeleton-loader>
          </v-col>
        </v-row>

        <!-- Empty State -->
        <v-row v-else-if="filteredWorkspaces.length === 0">
          <v-col cols="12">
            <v-card class="pa-8 text-center" variant="outlined">
              <v-icon :icon="icons.folderOff" size="64" color="grey" class="mb-4"></v-icon>
              <h3 class="text-h6 mb-2">No workspaces found</h3>
              <p class="text-body-2 text-medium-emphasis mb-4">
                {{
                  filter === 'all'
                    ? 'Create your first workspace to get started'
                    : `No ${filter} workspaces`
                }}
              </p>
              <v-btn
                v-if="filter === 'all'"
                color="primary"
                :prepend-icon="icons.plus"
                @click="openCreateDialog"
              >
                Create Workspace
              </v-btn>
            </v-card>
          </v-col>
        </v-row>

        <!-- Workspaces Grid -->
        <v-row v-else>
          <v-col
            v-for="workspace in filteredWorkspaces"
            :key="workspace.id"
            cols="12"
            md="6"
            lg="4"
          >
            <WorkspaceCard
              :workspace="workspace"
              @view="handleViewWorkspace"
              @edit="handleEditWorkspace"
              @toggle-status="handleToggleStatus"
              @delete="confirmDelete"
            />
          </v-col>
        </v-row>
      </v-container>
    </v-main>

    <!-- Workspace Dialog (Create/Update) -->
    <WorkspaceDialog
      v-model="showWorkspaceDialog"
      :mode="workspaceDialogMode"
      :workspace="workspaceToEdit"
      :pfs-options="workspacesStore.pfsOptions"
      :loading="isSubmitting"
      @submit="handleWorkspaceSubmit"
    />

    <!-- Archive Confirmation Dialog -->
    <ArchiveConfirmDialog
      v-model="showArchiveDialog"
      :workspace="workspacesStore.workspaces.find((w) => w.id === workspaceToArchive)"
      :loading="isTogglingStatus"
      @confirm="handleArchiveWorkspace"
    />

    <!-- Delete Confirmation Dialog -->
    <DeleteConfirmDialog
      v-model="showDeleteDialog"
      :loading="isDeleting"
      @confirm="handleDeleteWorkspace"
    />
  </v-app>
</template>
