<template>
  <HeaderBar
    :title="typesStore.hasMultipleTypes ? 'My Workspaces' : 'My PFS Workspaces'"
    :icon="icons.folderMultiple"
  />

  <v-main>
    <v-container>
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
                {{
                  workspacesStore.activeWorkspaces.length +
                  workspacesStore.archivedWorkspaces.length +
                  workspacesStore.sharedWorkspaces.length
                }}
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
            <v-btn value="shared">
              Shared
              <v-chip size="x-small" class="ml-2" color="primary">
                {{ workspacesStore.sharedWorkspaces.length }}
              </v-chip>
            </v-btn>
          </v-btn-toggle>
        </v-col>
      </v-row>

      <v-row v-if="workspacesStore.isLoading">
        <v-col v-for="n in 3" :key="n" cols="12" md="4">
          <v-skeleton-loader type="card"></v-skeleton-loader>
        </v-col>
      </v-row>

      <v-row v-else-if="!workspacesStore.loadFailed && workspacesStore.workspaces.length === 0">
        <v-col cols="12">
          <v-card class="welcome mx-auto mt-8 pa-6 pa-sm-12 text-center" variant="outlined">
            <v-icon :icon="icons.folderPlus" size="64" class="mb-4 text-subtle"></v-icon>
            <h2 class="text-h6 mb-2">Create your first workspace</h2>
            <p class="text-body-2 text-medium-emphasis mb-6">
              A workspace is your own draft copy of a specification. You can edit its files, preview
              the result and share it with others. When you are ready, you propose your changes to
              the maintainers for review.
            </p>

            <div v-if="typesStore.availableTypes.length > 0" class="mb-6">
              <p class="text-body-2 text-medium-emphasis mb-2">You can create workspaces for</p>
              <v-sheet
                v-for="type in typesStore.availableTypes"
                :key="type.id"
                border
                rounded
                color="transparent"
                class="d-flex flex-wrap align-center ga-3 pa-3 mb-2 text-left"
              >
                <v-icon :icon="icons.folder" :color="type.color"></v-icon>
                <div class="type-text">
                  <div class="text-body-1">{{ type.title }}</div>
                  <div class="text-body-2 text-medium-emphasis">{{ type.description }}</div>
                </div>
                <v-btn
                  v-if="type.upstream?.url"
                  variant="text"
                  size="small"
                  :append-icon="icons.openInNew"
                  :href="type.upstream.url"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View repository
                </v-btn>
              </v-sheet>
            </div>

            <p class="text-body-2 text-medium-emphasis text-left mb-6">
              Your first workspace also creates a copy (fork) of the repository on your GitHub
              account. Nothing changes in the official repository until you propose your changes.
            </p>

            <v-btn color="primary" :prepend-icon="icons.plus" @click="openCreateDialog">
              Create Workspace
            </v-btn>
          </v-card>
        </v-col>
      </v-row>

      <v-row v-else-if="filteredWorkspaces.length === 0">
        <v-col cols="12">
          <v-card class="pa-8 text-center text-subtle" variant="outlined">
            <v-icon :icon="icons.folderOff" size="64" class="mb-4"></v-icon>
            <h2 class="text-h6 mb-2">{{ emptyFilterText.title }}</h2>
            <p class="text-body-2 text-medium-emphasis mb-4">{{ emptyFilterText.hint }}</p>
            <v-btn v-if="filter !== 'all'" variant="outlined" @click="filter = 'all'">
              Show all workspaces
            </v-btn>
          </v-card>
        </v-col>
      </v-row>

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
            @share="handleShareWorkspace"
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
import { useTypesStore } from '@/stores/types';
import { useWorkspacesStore } from '@/stores/workspaces';
import { useNotificationsStore } from '@/stores/notifications';
import HeaderBar from '@/components/HeaderBar.vue';
import WorkspaceCard from '@/components/workspace/WorkspaceCard.vue';
import {
  mdiFolder,
  mdiFolderMultiple,
  mdiFolderOff,
  mdiFolderPlus,
  mdiOpenInNew,
  mdiPlus,
} from '@mdi/js';

// What an empty filter says, for users who have workspaces under other filters
const EMPTY_FILTER_TEXTS = {
  active: {
    title: 'No active workspaces',
    hint: 'Your archived workspaces and the ones shared with you are under the other filters.',
  },
  archived: {
    title: 'No archived workspaces',
    hint: 'Workspaces you archive are kept here, read-only, until you activate them again.',
  },
  shared: {
    title: 'No workspaces shared with you yet',
    hint: 'Workspaces other people share with you will show up here.',
  },
};

export default {
  name: 'WorkspacesView',

  components: {
    HeaderBar,
    WorkspaceCard,
  },

  data() {
    return {
      icons: {
        folder: mdiFolder,
        folderMultiple: mdiFolderMultiple,
        folderOff: mdiFolderOff,
        folderPlus: mdiFolderPlus,
        openInNew: mdiOpenInNew,
        plus: mdiPlus,
      },
      filter: 'active', // 'all', 'active', 'archived', 'shared'
    };
  },

  computed: {
    typesStore() {
      return useTypesStore();
    },

    workspacesStore() {
      return useWorkspacesStore();
    },

    notificationsStore() {
      return useNotificationsStore();
    },

    emptyFilterText() {
      return EMPTY_FILTER_TEXTS[this.filter] ?? { title: 'No workspaces found', hint: '' };
    },

    filteredWorkspaces() {
      const store = this.workspacesStore;

      switch (this.filter) {
        case 'active':
          return store.activeWorkspaces;
        case 'archived':
          return store.archivedWorkspaces;
        case 'shared':
          return store.sharedWorkspaces;
        default:
          return [
            ...store.activeWorkspaces,
            ...store.archivedWorkspaces,
            ...store.sharedWorkspaces,
          ];
      }
    },
  },

  async created() {
    await this.loadData();
  },

  methods: {
    async loadData() {
      try {
        await Promise.all([this.typesStore.fetchTypes(), this.workspacesStore.fetchWorkspaces()]);
      } catch (error) {
        this.notificationsStore.error(`Failed to load data: ${error.message}`);
      }
    },

    // Only owned workspaces count: the list also holds workspaces shared with the user, which live
    // in someone else's fork.
    // The first workspace of an upstream repository creates a fork of it
    ownedUpstreams() {
      return this.workspacesStore.workspaces
        .filter((w) => w.viewer_role === 'owner')
        .flatMap((w) => this.forkedUpstreams(w));
    },

    // A workspace continuing a pull request from another fork proposes to that fork, but its own fork is of
    // the type owner's repository, which GitHub names the fork after
    forkedUpstreams(workspace) {
      const upstreams = [`${workspace.upstream_owner}/${workspace.upstream_repo}`];
      const owner = useTypesStore().byId(workspace.type)?.upstream?.owner;
      if (owner && owner.toLowerCase() !== workspace.upstream_owner.toLowerCase()) {
        upstreams.push(`${owner}/${workspace.fork_repo_name}`);
      }
      return upstreams;
    },

    // The workspace dialog reads the types when it opens, e.g. its initial type
    async loadTypes() {
      try {
        await this.typesStore.fetchTypes();
        return true;
      } catch (error) {
        this.notificationsStore.error(`Failed to load the workspace types: ${error.message}`);
        return false;
      }
    },

    async openCreateDialog() {
      if (!(await this.loadTypes())) {
        return;
      }
      const mode = 'create';
      this.$root.openDialog('WorkspaceDialog', {
        mode,
        ownedUpstreams: this.ownedUpstreams(),
        onAcceptance: async (data) => await this.handleWorkspaceSubmit(data, mode),
      });
    },

    async handleWorkspaceSubmit(data, mode) {
      try {
        if (mode === 'create') {
          // Read before creating, which adds to the list
          const owned = this.ownedUpstreams();
          const workspace = await this.workspacesStore.createWorkspace(data);
          const isFirstWorkspace = !this.forkedUpstreams(workspace).some((upstream) =>
            owned.includes(upstream),
          );
          this.announceFork(workspace, isFirstWorkspace);
          this.handleViewWorkspace(workspace.id);
        } else {
          await this.workspacesStore.updateWorkspace(data.id, {
            title: data.title,
            selection: data.selection,
            description: data.description,
          });
          this.notificationsStore.success('Workspace updated successfully');
        }
      } catch (error) {
        throw new Error(`Failed to ${mode} workspace: ${error.message}`);
      }
    },

    // Point out the GitHub fork so nobody deletes it and breaks every workspace. Only the first
    // workspace creates it, so it gets the dialog; later ones just name it in the toast.
    announceFork(workspace, isFirstWorkspace) {
      const forkName =
        workspace?.fork_repo_owner && workspace?.fork_repo_name
          ? `${workspace.fork_repo_owner}/${workspace.fork_repo_name}`
          : null;

      if (forkName && isFirstWorkspace) {
        this.$root.openDialog('ForkCreatedDialog', { workspace });
        return;
      }

      this.notificationsStore.success(
        forkName
          ? `Workspace created successfully in your ${this.typesStore.byId(workspace.type)?.title} repository ${forkName}`
          : 'Workspace created successfully',
      );
    },

    handleViewWorkspace(workspaceId) {
      this.$router.push({
        name: 'editor',
        params: { id: workspaceId },
      });
    },

    async handleEditWorkspace(workspaceId) {
      const workspace = this.workspacesStore.workspaces.find((w) => w.id === workspaceId);
      const mode = 'update';
      if (workspace && (await this.loadTypes())) {
        this.$root.openDialog('WorkspaceDialog', {
          mode,
          workspace,
          onAcceptance: async (data) => await this.handleWorkspaceSubmit(data, mode),
        });
      }
    },

    handleShareWorkspace(workspaceId) {
      const workspace = this.workspacesStore.workspaces.find((w) => w.id === workspaceId);
      if (workspace) {
        this.$root.openDialog('ShareDialog', { workspace });
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

<style scoped>
/* Narrow so the box fits its content and the text stays readable on wide screens */
.welcome {
  max-width: 752px;
}

/* The description wraps beside the icon; on narrow screens the button moves below */
.type-text {
  flex: 1 1 160px;
  min-width: 0;
}
</style>
