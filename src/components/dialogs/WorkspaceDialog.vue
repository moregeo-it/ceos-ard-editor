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
            :items="workspacesStore.pfsOptions"
            label="Product Format Specification (Optional)"
            multiple
            chips
            hint="If not selected, backend will assign a default PFS"
            persistent-hint
            class="mb-3"
          />

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
      rules: {
        title: [
          (v) => !!v || 'Title is required',
          (v) => (v && v.length >= 3) || 'Title must be at least 3 characters',
        ],
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
  },
  methods: {
    async handleSubmit() {
      const { valid } = await this.$refs.form.validate();
      if (!valid) return;

      const payload = {
        title: this.formData.title,
        description: this.formData.description || null,
        pfs: this.formData.pfs && this.formData.pfs.length > 0 ? this.formData.pfs : null,
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
