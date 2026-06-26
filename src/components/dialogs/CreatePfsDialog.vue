<template>
  <v-dialog v-model="show" :max-width="sizes.medium">
    <v-form @submit.prevent="handleCreate">
      <v-card>
        <v-card-title>Create New PFS</v-card-title>
        <v-card-text>
          <v-text-field
            v-model.trim="folderName"
            variant="outlined"
            label="Folder Name"
            placeholder="e.g., my-new-pfs"
            hint="Creates /pfs/<folder-name>/document.yaml"
            persistent-hint
            density="compact"
            class="mb-3"
            @input="folderName = folderName.toUpperCase()"
            :error-messages="folderNameError"
            autofocus
          />

          <v-select
            v-model="selectedPfs"
            :items="pfsOptions"
            item-title="name"
            item-value="id"
            variant="outlined"
            label="Source PFS"
            hint="The selected PFS document will be copied into the new folder"
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
      folderName: '',
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
    folderNameError() {
      if (!this.folderName || this.folderName.trim().length < 2) {
        return ['Please provide a folder name with at least 2 characters'];
      }

      if (this.folderName.includes('/')) {
        return ['Folder name should not contain /'];
      }

      return [];
    },
    isValid() {
      return this.folderNameError.length === 0;
    },
  },
  async created() {
    const workspaceId = this.workspacesStore.currentWorkspace?.id;
    if (this.pfsOptions.length === 0 && workspaceId) {
      this.isLoadingPfs = true;
      try {
        await this.workspacesStore.fetchWorkspacePfs(workspaceId);
      } finally {
        this.isLoadingPfs = false;
      }
    }
  },
  watch: {
    pfsOptions: {
      immediate: true,
      handler(options) {
        if (!this.selectedPfs && options.length > 0) {
          this.selectedPfs = options[0];
        }
      },
    },
  },
  methods: {
    handleCreate() {
      if (!this.isValid) {
        throw new Error('Please resolve the validation errors before submitting.');
      }

      this.accept({
        name: this.folderName.trim(),
        sourcePfs: this.selectedPfs,
      });
    },
  },
};
</script>
