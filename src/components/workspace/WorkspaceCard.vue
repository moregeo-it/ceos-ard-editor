<script>
import { mdiFolder, mdiFileDocument, mdiCalendar, mdiUpdate, mdiEye, mdiArchive } from '@mdi/js'

export default {
  name: 'WorkspaceCard',

  props: {
    workspace: {
      type: Object,
      required: true,
    },
  },

  emits: ['view', 'archive'],

  data() {
    return {
      icons: {
        folder: mdiFolder,
        fileDocument: mdiFileDocument,
        calendar: mdiCalendar,
        update: mdiUpdate,
        eye: mdiEye,
        archive: mdiArchive,
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
  },

  methods: {
    handleView() {
      this.$emit('view', this.workspace.id)
    },

    handleArchive() {
      this.$emit('archive', this.workspace.id)
    },
  },
}
</script>

<template>
  <v-card :disabled="isArchived" hover>
    <v-card-title class="d-flex align-center">
      <v-icon :icon="icons.folder" start></v-icon>
      {{ workspace.title }}
      <v-spacer></v-spacer>
      <v-chip :color="statusColor" size="small" variant="flat">
        {{ workspace.status }}
      </v-chip>
    </v-card-title>

    <v-card-subtitle v-if="workspace.pfs" class="mt-2">
      <v-icon :icon="icons.fileDocument" size="small" start></v-icon>
      {{ workspace.pfs }}
    </v-card-subtitle>

    <v-card-text v-if="workspace.description">
      <p class="text-body-2 text-medium-emphasis">
        {{ workspace.description }}
      </p>
    </v-card-text>

    <v-card-text v-if="workspace.created_at || workspace.updated_at">
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

    <v-card-actions>
      <v-btn
        color="primary"
        variant="text"
        :prepend-icon="icons.eye"
        @click="handleView"
        :disabled="isArchived"
      >
        View
      </v-btn>
      <v-spacer></v-spacer>
      <v-btn
        v-if="!isArchived"
        color="error"
        variant="text"
        :prepend-icon="icons.archive"
        @click="handleArchive"
      >
        Archive
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
