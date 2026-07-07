<template>
  <v-card hover :link="false" class="workspace-card h-100 d-flex flex-column" @click="handleView">
    <v-card-title class="d-flex align-center">
      <v-icon :icon="icons.folder" start></v-icon>
      {{ workspace.title }}
      <v-spacer></v-spacer>
      <ShareModeChip v-if="!isOwner" :mode="workspace.viewer_role" class="mr-2" />
      <v-chip :color="statusColor" size="small" variant="flat">
        {{ workspace.status }}
      </v-chip>
    </v-card-title>

    <v-card-subtitle class="mt-2">
      <PfsBadges v-if="workspace.pfs" :pfs="workspace.pfs" />
      <p v-else>No PFS assigned</p>
    </v-card-subtitle>

    <v-card-text class="d-flex flex-column flex-grow-1">
      <p class="description text-body-2 text-medium-emphasis flex-grow-1 overflow-auto">
        {{ workspace.description || 'No description provided.' }}
      </p>

      <p class="d-flex justify-space-between text-caption text-medium-emphasis mt-4">
        <template v-if="isArchived">
          <span>
            <v-icon :icon="icons.archive" size="x-small" start></v-icon>
            Archived: {{ formatDate(workspace.archived_at) }}
          </span>
          <span>
            <v-icon :icon="icons.delete" size="x-small" start></v-icon>
            Deletion: {{ formatDate(workspace.deletion_at) }}
          </span>
        </template>
        <template v-else>
          <span>
            <v-icon :icon="icons.calendar" size="x-small" start></v-icon>
            Created: {{ formatDate(workspace.created_at) }}
          </span>
          <span>
            <v-icon :icon="icons.update" size="x-small" start></v-icon>
            Updated: {{ formatDate(workspace.updated_at) }}
          </span>
        </template>
      </p>
    </v-card-text>

    <v-card-actions class="mt-auto flex-wrap cursor-default border-t-sm" @click.stop>
      <template v-if="isOwner">
        <v-btn variant="text" :prepend-icon="icons.pencil" @click.stop="handleEdit">Settings</v-btn>
        <v-btn variant="text" :prepend-icon="icons.share" @click.stop="handleShare">Share</v-btn>
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
      </template>
      <template v-else>
        <span class="text-caption text-medium-emphasis">Shared by {{ ownerLabel }}</span>
      </template>
    </v-card-actions>
  </v-card>
</template>

<script>
import PfsBadges from './PfsBadges.vue';
import ShareModeChip from './ShareModeChip.vue';
import {
  mdiFolder,
  mdiCalendar,
  mdiUpdate,
  mdiArchive,
  mdiPencil,
  mdiDelete,
  mdiPackageUp,
  mdiShareVariant,
} from '@mdi/js';

export default {
  name: 'WorkspaceCard',

  components: {
    PfsBadges,
    ShareModeChip,
  },

  props: {
    workspace: {
      type: Object,
      required: true,
    },
  },

  emits: ['view', 'edit', 'toggle-status', 'delete', 'share'],

  data() {
    return {
      icons: {
        folder: mdiFolder,
        calendar: mdiCalendar,
        update: mdiUpdate,
        archive: mdiArchive,
        pencil: mdiPencil,
        delete: mdiDelete,
        activate: mdiPackageUp,
        share: mdiShareVariant,
      },
    };
  },

  computed: {
    statusColor() {
      return this.workspace.status === 'active' ? 'success' : 'grey';
    },

    isArchived() {
      return this.workspace.status === 'archived' || false;
    },

    isOwner() {
      return this.workspace.viewer_role === 'owner';
    },

    ownerLabel() {
      return this.workspace.owner_username || 'another user';
    },

    toggleStatusLabel() {
      return this.isArchived ? 'Activate' : 'Archive';
    },

    toggleStatusIcon() {
      return this.isArchived ? this.icons.activate : this.icons.archive;
    },

    toggleStatusColor() {
      return this.isArchived ? 'success' : 'warning';
    },
  },

  methods: {
    handleView() {
      this.$emit('view', this.workspace.id);
    },

    handleEdit() {
      this.$emit('edit', this.workspace.id);
    },

    handleShare() {
      this.$emit('share', this.workspace.id);
    },

    handleToggleStatus() {
      this.$emit('toggle-status', this.workspace.id);
    },

    handleDelete() {
      this.$emit('delete', this.workspace.id);
    },
    formatDate(dateString) {
      if (!dateString) return 'n/a';
      const date = new Date(dateString);
      return date.toLocaleString();
    },
  },
};
</script>

<style scoped>
.description {
  max-height: 5rem;
}
</style>
