<template>
  <v-dialog v-model="show" :max-width="sizes.medium">
    <v-form @submit.prevent="handleCreate">
      <v-card>
        <v-card-title>Create New PFS</v-card-title>
        <v-card-text>
          <v-text-field
            v-model.trim="id"
            variant="outlined"
            label="ID"
            placeholder="e.g., SR"
            hint="Creates a new PFS folder in the workspace with the specified name"
            persistent-hint
            density="compact"
            class="mb-3"
            @input="id = id.toUpperCase()"
            :error-messages="idError"
            autofocus
          />

          <v-text-field
            v-model.trim="title"
            variant="outlined"
            label="Title"
            placeholder="e.g., Surface Temperature"
            hint="The title of the new PFS document"
            persistent-hint
            density="compact"
            class="mb-3"
          />

          <v-text-field
            v-model.trim="applies_to"
            variant="outlined"
            label="Applies To"
            placeholder="e.g., Data collected by Synthetic Aperture Radar sensors"
            hint="The description of the new PFS document"
            persistent-hint
            density="compact"
            class="mb-3"
          />

          <v-select
            v-model="selectedPfs"
            :items="pfsOptions"
            item-title="name"
            item-value="id"
            variant="outlined"
            label="Base PFS"
            hint="The selected PFS document will be used as the base for the new folder"
            persistent-hint
            density="compact"
            class="mb-3"
            :loading="isLoadingPfs"
          >
            <template v-slot:selection="{ item }">
              {{ item.raw.name }}
            </template>
          </v-select>

          <v-alert v-if="pfsOptions.length === 0" type="info" variant="tonal" density="compact">
            No workspace PFS options are available yet.
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="reject" :disabled="accepting">Cancel</v-btn>
          <v-btn
            color="primary"
            type="submit"
            :disabled="!isValid || accepting"
            :loading="accepting"
            variant="elevated"
            >Create</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-form>
  </v-dialog>
</template>

<script>
import DialogMixin from '@/components/DialogMixin';
import { useWorkspacesStore } from '@/stores/workspaces';

export default {
  name: 'CreatePfsDialog',
  mixins: [DialogMixin],
  data() {
    return {
      id: '',
      title: '',
      applies_to: '',
      selectedPfs: null,
      isLoadingPfs: false,
    };
  },
  computed: {
    workspacesStore() {
      return useWorkspacesStore();
    },
    pfsOptions() {
      return this.workspacesStore.workspacePfsOptions || [];
    },
    idError() {
      if (!this.id || this.id.trim().length < 2) {
        return ['Please provide a PFS ID with at least 2 characters'];
      }

      if (this.id.includes('/')) {
        return ['PFS ID should not contain /'];
      }

      return [];
    },
    isValid() {
      return this.idError.length === 0 && !!this.selectedPfs;
    },
  },
  async created() {
    const workspaceId = this.workspacesStore.currentWorkspace?.id;
    if (workspaceId) {
      this.isLoadingPfs = true;
      try {
        await this.workspacesStore.fetchWorkspacePfs(workspaceId);
      } finally {
        this.isLoadingPfs = false;
      }
    }

    this.selectedPfs = this.pfsOptions.length > 0 ? this.pfsOptions[0].id : null;
  },
  methods: {
    handleCreate() {
      if (!this.isValid) {
        return;
      }

      this.accept({
        id: this.id,
        title: this.title,
        base_pfs: this.selectedPfs,
        applies_to: this.applies_to,
      });
    },
  },
};
</script>
