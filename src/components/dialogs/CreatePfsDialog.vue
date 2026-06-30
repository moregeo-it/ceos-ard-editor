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
            class="mb-4"
            :error-messages="idError"
            autofocus
            @blur="touched.id = true"
          />

          <v-text-field
            v-model.trim="title"
            variant="outlined"
            label="Title"
            placeholder="e.g., Surface Temperature"
            hint="The title of the new PFS document"
            persistent-hint
            density="compact"
            class="mb-4"
            :error-messages="titleError"
            @blur="touched.title = true"
          />

          <v-textarea
            v-model.trim="applies_to"
            variant="outlined"
            label="Applies To"
            placeholder="e.g., Data collected by Synthetic Aperture Radar sensors"
            hint="The description of the new PFS document"
            persistent-hint
            density="compact"
            class="mb-4"
          />

          <PfsSelect
            v-model="selectedPfs"
            :items="pfsOptions"
            label="Base PFS"
            hint="The selected PFS document will be used as the base for the new folder"
            persistent-hint
            :clearable="true"
            :loading="isLoadingPfs"
            class="mb-4"
          />

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
import PfsSelect from '@/components/PfsSelect.vue';

export default {
  name: 'CreatePfsDialog',
  mixins: [DialogMixin],
  components: {
    PfsSelect,
  },
  data() {
    return {
      id: '',
      title: '',
      applies_to: '',
      selectedPfs: null,
      isLoadingPfs: false,
      touched: {
        id: false,
        title: false,
      },
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
      if (!this.touched.id) return [];
      if (!this.id || this.id.trim().length < 2) {
        return ['Please provide a PFS ID with at least 2 characters'];
      }

      return [];
    },
    titleError() {
      if (!this.touched.title) return [];
      if (!this.title || this.title.trim().length < 1) {
        return ['Title is required'];
      }

      return [];
    },
    isValid() {
      return this.idError.length === 0 && this.titleError.length === 0;
    },
  },
  async created() {
    const workspaceId = this.workspacesStore.currentWorkspace?.id;
    if (workspaceId) {
      this.isLoadingPfs = true;
      try {
        await this.workspacesStore.fetchPfs(workspaceId);
      } finally {
        this.isLoadingPfs = false;
      }
    }
  },
  methods: {
    handleCreate() {
      this.touched.id = true;
      this.touched.title = true;
      if (!this.isValid) {
        return;
      }

      this.accept({
        id: this.id,
        title: this.title,
        base: this.selectedPfs,
        applies_to: this.applies_to,
      });
    },
  },
};
</script>
