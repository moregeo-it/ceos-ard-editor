<script>
import PfsBadges from './PfsBadges.vue'
import {
  mdiFolder,
  mdiCalendar,
  mdiUpdate,
  mdiEye,
  mdiArchive,
  mdiPencil,
  mdiDelete,
  mdiPackageUp,
} from '@mdi/js'

export default {
  name: 'WorkspaceCard',

  components: {
    PfsBadges,
  },

  props: {
    workspace: {
      type: Object,
      required: true,
    },
  },

  emits: ['view', 'edit', 'toggle-status', 'delete'],

  data() {
    return {
      icons: {
        folder: mdiFolder,
        calendar: mdiCalendar,
        update: mdiUpdate,
        eye: mdiEye,
        archive: mdiArchive,
        pencil: mdiPencil,
        delete: mdiDelete,
        activate: mdiPackageUp,
      },
    }
  },

  computed: {
    statusColor() {
      return this.workspace.status === 'active' ? 'success' : 'grey'
    },

    isArchived() {
      return this.workspace.status === 'archived'
    },

    toggleStatusLabel() {
      return this.isArchived ? 'Activate' : 'Archive'
    },

    toggleStatusIcon() {
      return this.isArchived ? this.icons.activate : this.icons.archive
    },

    toggleStatusColor() {
      return this.isArchived ? 'success' : 'warning'
    },
  },

  methods: {
    handleView() {
      this.$emit('view', this.workspace.id)
    },

    handleEdit() {
      this.$emit('edit', this.workspace.id)
    },

    handleToggleStatus() {
      this.$emit('toggle-status', this.workspace.id)
    },

    handleDelete() {
      this.$emit('delete', this.workspace.id)
    },
  },
}
</script>

<template>
  <v-card
    hover
    class="d-flex flex-column workspace-card"
    style="height: 100%; cursor: pointer"
    @click="handleView"
  >
    <v-card-title class="d-flex align-center">
      <v-icon :icon="icons.folder" start></v-icon>
      {{ workspace.title }}
      <v-spacer></v-spacer>
      <v-chip :color="statusColor" size="small" variant="flat">
        {{ workspace.status }}
      </v-chip>
    </v-card-title>

    <v-card-subtitle class="mt-2">
      <PfsBadges :pfs="workspace.pfs" />
    </v-card-subtitle>

    <v-card-text class="flex-grow-1">
      <p class="text-body-2 text-medium-emphasis">
        {{ workspace.description || 'No description provided.' }}
      </p>
    </v-card-text>

    <!-- Active workspace timestamps -->
    <v-card-text v-if="!isArchived && (workspace.created_at || workspace.updated_at)">
      <v-divider class="mb-3"></v-divider>
      <div class="d-flex justify-space-between text-caption text-medium-emphasis">
        <span v-if="workspace.created_at">
          <v-icon :icon="icons.calendar" size="x-small" start></v-icon>
          Created: {{ new Date(workspace.created_at).toLocaleDateString() }}
        </span>
        <span v-if="workspace.updated_at">
          <v-icon :icon="icons.update" size="x-small" start></v-icon>
          Updated: {{ new Date(workspace.updated_at).toLocaleDateString() }}
        </span>
      </div>
    </v-card-text>

    <!-- Archived workspace timestamps -->
    <v-card-text v-if="isArchived && (workspace.archived_at || workspace.deletion_at)">
      <v-divider class="mb-3"></v-divider>
      <div class="d-flex justify-space-between text-caption text-medium-emphasis">
        <span v-if="workspace.archived_at">
          <v-icon :icon="icons.archive" size="x-small" start></v-icon>
          Archived: {{ new Date(workspace.archived_at).toLocaleDateString() }}
        </span>
        <span v-if="workspace.deletion_at">
          <v-icon :icon="icons.delete" size="x-small" start></v-icon>
          Deletion: {{ new Date(workspace.deletion_at).toLocaleDateString() }}
        </span>
      </div>
    </v-card-text>

    <v-card-actions class="mt-auto flex-wrap">
      <v-btn color="primary" variant="text" :prepend-icon="icons.eye" @click.stop="handleView">
        View
      </v-btn>
      <v-btn variant="text" :prepend-icon="icons.pencil" @click.stop="handleEdit"> Update </v-btn>
      <v-spacer></v-spacer>
      <v-btn
        :color="toggleStatusColor"
        variant="text"
        :prepend-icon="toggleStatusIcon"
        @click.stop="handleToggleStatus"
      >
        {{ toggleStatusLabel }}
      </v-btn>
      <v-btn color="error" variant="text" :prepend-icon="icons.delete" @click.stop="handleDelete">
        Delete
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
