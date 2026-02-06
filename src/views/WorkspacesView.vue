<template>
  <HeaderBar title="My PFS Workspaces" :icon="icons.folderMultiple" />

  <!-- Main Content -->
  <v-main>
    <v-container>
      <!-- Toolbar -->
      <v-row class="mb-4">
        <v-col cols="12" md="6">
          <v-btn color="primary" size="large" :prepend-icon="icons.plus" @click="openCreateDialog">
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
          <v-card class="pa-8 text-center text-subtle" variant="outlined">
            <v-icon :icon="icons.folderOff" size="64" class="mb-4"></v-icon>
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
          lg="6"
          xl="4"
        >
          <WorkspaceCard
            v-if="!workspacesStore.isWorkspaceLoading[workspace.id]"
            :workspace="workspace"
            @view="handleViewWorkspace"
            @edit="handleEditWorkspace"
            @toggle-status="handleToggleStatus"
            @delete="confirmDelete"
          />
          <v-skeleton-loader v-else type="card"></v-skeleton-loader>
        </v-col>
      </v-row>
    </v-container>
  </v-main>
</template>

<script>
import { useAuthStore } from '@/stores/auth';
import { useWorkspacesStore } from '@/stores/workspaces';
import { useNotificationsStore } from '@/stores/notifications';
import HeaderBar from '@/components/HeaderBar.vue';
import WorkspaceCard from '@/components/workspace/WorkspaceCard.vue';
import { mdiFolderMultiple, mdiPlus, mdiFolderOff } from '@mdi/js';

export default {
  name: 'WorkspacesView',

  components: {
    HeaderBar,
    WorkspaceCard,
  },

  data() {
    return {
      icons: {
        folderMultiple: mdiFolderMultiple,
        plus: mdiPlus,
        folderOff: mdiFolderOff,
      },
      filter: 'active', // 'all', 'active', 'archived'
    };
  },

  computed: {
    authStore() {
      return useAuthStore();
    },

    workspacesStore() {
      return useWorkspacesStore();
    },

    notificationsStore() {
      return useNotificationsStore();
    },

    username() {
      return this.authStore.getUsername;
    },

    filteredWorkspaces() {
      const store = this.workspacesStore;

      switch (this.filter) {
        case 'active':
          return store.activeWorkspaces;
        case 'archived':
          return store.archivedWorkspaces;
        default:
          return store.workspaces;
      }
    },
  },

  async created() {
    await this.loadData();
  },

  methods: {
    async loadData() {
      try {
        await Promise.all([
          this.workspacesStore.fetchWorkspaces(),
          this.workspacesStore.fetchPfs(),
        ]);
      } catch (error) {
        this.notificationsStore.error(`Failed to load data: ${error.message}`);
      }
    },

    openCreateDialog() {
      const mode = 'create';
      this.$root.openDialog('WorkspaceDialog', {
        mode,
        onAcceptance: async (data) => await this.handleWorkspaceSubmit(data, mode),
      });
    },

    async handleWorkspaceSubmit(data, mode) {
      try {
        if (mode === 'create') {
          await this.workspacesStore.createWorkspace(data);
          this.notificationsStore.success('Workspace created successfully');
        } else {
          await this.workspacesStore.updateWorkspace(data.id, {
            title: data.title,
            pfs: data.pfs,
            description: data.description,
          });
          this.notificationsStore.success('Workspace updated successfully');
        }
      } catch (error) {
        throw new Error(`Failed to ${mode} workspace: ${error.message}`);
      }
    },

    handleViewWorkspace(workspaceId) {
      this.$router.push({
        name: 'editor',
        params: { id: workspaceId },
      });
    },

    handleEditWorkspace(workspaceId) {
      const workspace = this.workspacesStore.workspaces.find((w) => w.id === workspaceId);
      const mode = 'update';
      if (workspace) {
        this.$root.openDialog('WorkspaceDialog', {
          mode,
          workspace,
          onAcceptance: async (data) => await this.handleWorkspaceSubmit(data, mode),
        });
      }
    },

    async handleToggleStatus(workspaceId) {
      const workspace = this.workspacesStore.workspaces.find((w) => w.id === workspaceId);

      // If workspace is active, show archive confirmation dialog
      if (workspace?.status === 'active') {
        this.$root.openDialog('ArchiveWorkspaceDialog', {
          workspace,
          onAcceptance: async () => await this.handleArchiveWorkspace(workspaceId),
        });
      } else {
        // If workspace is archived, reactivate immediately without confirmation
        try {
          await this.workspacesStore.toggleWorkspaceStatus(workspaceId);
          this.notificationsStore.success('Workspace activated successfully');
        } catch (error) {
          this.notificationsStore.error(`Failed to activate workspace: ${error.message}`);
        }
      }
    },

    async handleArchiveWorkspace(workspaceId) {
      await this.workspacesStore.toggleWorkspaceStatus(workspaceId);
      this.notificationsStore.success('Workspace archived successfully');
    },

    confirmDelete(workspaceId) {
      this.$root.openDialog('ConfirmDialog', {
        title: 'Delete Workspace?',
        message: 'Are you sure you want to delete this workspace? This action cannot be undone.',
        confirmButton: 'Delete Permanently',
        confirmButtonColor: 'error',
        onAcceptance: async () => await this.handleDeleteWorkspace(workspaceId),
      });
    },

    async handleDeleteWorkspace(workspaceId) {
      await this.workspacesStore.deleteWorkspace(workspaceId);
      this.notificationsStore.success('Workspace deleted successfully');
    },
  },
};
</script>
