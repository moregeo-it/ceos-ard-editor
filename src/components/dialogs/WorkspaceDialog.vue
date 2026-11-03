<template>
  <v-dialog v-model="show" :max-width="sizes.medium">
    <v-form ref="form" @submit.prevent="handleSubmit">
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon :icon="dialogIcon" start></v-icon>
          {{ dialogTitle }}
        </v-card-title>

        <v-divider></v-divider>

        <v-card-text class="pt-6">
          <v-text-field
            v-model="formData.title"
            label="Workspace Title"
            placeholder="My CEOS-ARD Workspace"
            :rules="rules.title"
            variant="outlined"
            :prepend-inner-icon="icons.folder"
            required
            autofocus
            class="mb-3"
          ></v-text-field>

          <PfsSelect
            v-model="formData.pfs"
            :items="pfsItems"
            :loading="loadingPfs"
            :no-data-text="loadingPfs ? 'Loading PFS…' : undefined"
            label="Product Format Specification"
            multiple
            chips
            :rules="rules.pfs"
            hint="The workspace preview is generated from these PFS, for everyone with access."
            persistent-hint
            class="mb-3"
          />

          <v-alert v-if="pfsError" type="warning" variant="tonal" density="compact" class="mb-3">
            Couldn't load PFSes of this workspace, so newly added PFS are missing currently.
          </v-alert>

          <v-textarea
            v-model="formData.description"
            persistent-counter
            label="Description (Optional)"
            placeholder="Describe the purpose of this workspace..."
            variant="outlined"
            :prepend-inner-icon="icons.text"
            rows="3"
            counter
            maxlength="500"
          ></v-textarea>

          <v-alert
            v-if="createsRepository && !isUpdateMode"
            type="info"
            variant="tonal"
            density="compact"
            class="mt-3"
          >
            Creating your first workspace also creates a copy (fork) of the CEOS-ARD repository on
            your GitHub account. All of your workspaces are stored there.
          </v-alert>
        </v-card-text>

        <v-divider></v-divider>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="reject">Cancel</v-btn>
          <v-btn color="primary" variant="elevated" :loading="accepting" type="submit">
            {{ submitButtonText }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-form>
  </v-dialog>
</template>

<script>
import DialogMixin from '@/components/DialogMixin';
import workspaceService from '@/services/workspace.service';
import { useWorkspacesStore } from '@/stores/workspaces';
import { mdiFolderPlus, mdiFolderEdit, mdiFolder, mdiFileDocument, mdiText } from '@mdi/js';
import PfsSelect from '@/components/PfsSelect.vue';

export default {
  name: 'WorkspaceDialog',
  mixins: [DialogMixin],
  components: {
    PfsSelect,
  },
  props: {
    mode: {
      type: String,
      default: 'create',
      validator: (value) => ['create', 'update'].includes(value),
    },
    workspace: {
      type: Object,
      default: null,
    },
    // The first workspace creates the user's GitHub fork, which the dialog discloses up front
    createsRepository: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      icons: {
        folderPlus: mdiFolderPlus,
        folderEdit: mdiFolderEdit,
        folder: mdiFolder,
        fileDocument: mdiFileDocument,
        text: mdiText,
      },
      formData: {
        title: '',
        pfs: [],
        description: '',
      },
      // The workspace's own PFS, including ones created in it but not merged upstream yet
      workspacePfs: null,
      loadingPfs: false,
      pfsError: null,
      rules: {
        title: [
          (v) => !!v || 'Title is required',
          (v) => (v && v.length >= 3) || 'Title must be at least 3 characters',
        ],
        pfs: [(v) => v?.length > 0 || 'Select at least one PFS'],
      },
    };
  },
  computed: {
    workspacesStore() {
      return useWorkspacesStore();
    },
    isUpdateMode() {
      return this.mode === 'update';
    },
    dialogTitle() {
      return this.isUpdateMode ? 'Update Workspace' : 'Create New Workspace';
    },
    dialogIcon() {
      return this.isUpdateMode ? this.icons.folderEdit : this.icons.folderPlus;
    },
    submitButtonText() {
      return this.isUpdateMode ? 'Update Workspace' : 'Create Workspace';
    },
    pfsItems() {
      if (this.loadingPfs) {
        return [];
      }
      return this.workspacePfs ?? this.workspacesStore.pfsOptions;
    },
  },
  created() {
    if (this.workspace) {
      const pfsIds = Array.isArray(this.workspace.pfs)
        ? this.workspace.pfs
        : this.workspace.pfs
          ? [this.workspace.pfs]
          : [];
      this.formData = {
        title: this.workspace.title || '',
        pfs: pfsIds,
        description: this.workspace.description || '',
      };
    }
    if (this.isUpdateMode && this.workspace) {
      this.loadWorkspacePfs();
    }
  },
  methods: {
    async loadWorkspacePfs() {
      this.loadingPfs = true;
      try {
        this.workspacePfs = await workspaceService.fetchPfs(this.workspace.id);
      } catch (error) {
        this.pfsError = error.message;
      } finally {
        this.loadingPfs = false;
      }
    },
    async handleSubmit() {
      const { valid } = await this.$refs.form.validate();
      if (!valid) return;

      const payload = {
        title: this.formData.title,
        description: this.formData.description || null,
        pfs: this.formData.pfs,
      };

      // Include workspace ID for update mode
      if (this.isUpdateMode && this.workspace) {
        payload.id = this.workspace.id;
      }

      this.accept(payload);
    },
  },
};
</script>
