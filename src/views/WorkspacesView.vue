<script>
import { useAuthStore } from '@/stores/auth'
import { useWorkspacesStore } from '@/stores/workspaces'
import WorkspaceCard from '@/components/workspace/WorkspaceCard.vue'
import CreateWorkspaceDialog from '@/components/workspace/CreateWorkspaceDialog.vue'
import UpdateWorkspaceDialog from '@/components/workspace/UpdateWorkspaceDialog.vue'
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
    CreateWorkspaceDialog,
    UpdateWorkspaceDialog,
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
      showCreateDialog: false,
      showUserMenu: false,
      showUpdateDialog: false,
      workspaceToUpdate: null,
      isUpdating: false,
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

    async handleCreateWorkspace(workspaceData) {
      try {
        await this.workspacesStore.createWorkspace(workspaceData)
        this.showCreateDialog = false
      } catch (error) {
        console.error('Failed to create workspace:', error)
      }
    },

    handleViewWorkspace(workspaceId) {
      this.$router.push({
        name: 'workspace-detail',
        params: { id: workspaceId },
      })
    },

    handleEditWorkspace(workspaceId) {
      const workspace = this.workspacesStore.workspaces.find((w) => w.id === workspaceId)
      if (workspace) {
        this.workspaceToUpdate = workspace
        this.showUpdateDialog = true
      }
    },

    async handleUpdateWorkspace(updateData) {
      this.isUpdating = true
      try {
        await this.workspacesStore.updateWorkspace(updateData.id, {
          title: updateData.title,
          pfs: updateData.pfs,
          description: updateData.description,
        })
        this.showUpdateDialog = false
        this.workspaceToUpdate = null
      } catch (error) {
        console.error('Failed to update workspace:', error)
      } finally {
        this.isUpdating = false
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
              @click="showCreateDialog = true"
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
                @click="showCreateDialog = true"
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

    <!-- Create Workspace Dialog -->
    <CreateWorkspaceDialog
      v-model="showCreateDialog"
      :pfs-options="workspacesStore.pfsOptions"
      :loading="workspacesStore.isCreating"
      @submit="handleCreateWorkspace"
    />

    <!-- Update Workspace Dialog -->
    <UpdateWorkspaceDialog
      v-model="showUpdateDialog"
      :workspace="workspaceToUpdate"
      :pfs-options="workspacesStore.pfsOptions"
      :loading="isUpdating"
      @submit="handleUpdateWorkspace"
    />

    <!-- Archive Confirmation Dialog -->
    <v-dialog v-model="showArchiveDialog" max-width="500" persistent>
      <v-card>
        <v-card-title class="d-flex align-center">
          Archive Workspace?
          <v-spacer></v-spacer>
          <v-btn
            :icon="icons.close"
            variant="text"
            @click="showArchiveDialog = false"
            :disabled="isTogglingStatus"
          ></v-btn>
        </v-card-title>
        <v-card-text>
          <p class="mb-2">Are you sure you want to archive this workspace?</p>
          <v-alert type="warning" variant="tonal" density="compact" class="mt-2">
            <template v-if="workspaceToArchive">
              <div
                v-if="
                  workspacesStore.workspaces.find((w) => w.id === workspaceToArchive)?.deletion_at
                "
              >
                This workspace will be
                <strong
                  >permanently deleted on
                  {{
                    new Date(
                      workspacesStore.workspaces.find(
                        (w) => w.id === workspaceToArchive,
                      ).deletion_at,
                    ).toLocaleDateString()
                  }}</strong
                >
                unless reactivated before that date.
              </div>
              <div v-else>
                Archived workspaces will be scheduled for automatic deletion after a retention
                period of one month. You can reactivate it anytime before deletion.
              </div>
            </template>
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="showArchiveDialog = false" :disabled="isTogglingStatus">Cancel</v-btn>
          <v-btn color="warning" :loading="isTogglingStatus" @click="handleArchiveWorkspace">
            Archive
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="400" persistent>
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
          Are you sure you want to permanently delete this workspace? This action cannot be undone.
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
