<template>
  <v-dialog v-model="showDialog" max-width="600">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon :icon="dialogIcon" start></v-icon>
        {{ dialogTitle }}
        <v-spacer></v-spacer>
        <v-btn :icon="icons.close" variant="text" @click="handleClose" :disabled="loading"></v-btn>
      </v-card-title>

      <v-divider></v-divider>

      <v-card-text class="pt-6">
        <v-form ref="form">
          <v-text-field
            v-model="formData.title"
            label="Workspace Title"
            placeholder="My CEOS-ARD Workspace"
            :rules="rules.title"
            variant="outlined"
            :prepend-inner-icon="icons.folder"
            required
          ></v-text-field>

          <v-select
            v-model="formData.pfs"
            :items="pfsOptions"
            label="Product Format Specification (Optional)"
            placeholder="Select one or more PFS types"
            variant="outlined"
            :prepend-inner-icon="icons.fileDocument"
            clearable
            multiple
            chips
            hint="If not selected, backend will assign a default PFS"
            persistent-hint
            class="mb-4"
          ></v-select>

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
        </v-form>
      </v-card-text>

      <v-divider></v-divider>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="handleClose" :disabled="loading"> Cancel </v-btn>
        <v-btn color="primary" variant="elevated" :loading="loading" @click="handleSubmit">
          {{ submitButtonText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import {
  mdiFolderPlus,
  mdiFolderEdit,
  mdiFolder,
  mdiFileDocument,
  mdiText,
  mdiClose,
} from '@mdi/js';

export default {
  name: 'WorkspaceDialog',

  props: {
    modelValue: Boolean,
    mode: {
      type: String,
      default: 'create',
      validator: (value) => ['create', 'update'].includes(value),
    },
    workspace: {
      type: Object,
      default: null,
    },
    pfsOptions: {
      type: Array,
      default: () => [],
    },
    loading: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['update:modelValue', 'submit'],

  data() {
    return {
      icons: {
        folderPlus: mdiFolderPlus,
        folderEdit: mdiFolderEdit,
        folder: mdiFolder,
        fileDocument: mdiFileDocument,
        text: mdiText,
        close: mdiClose,
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
    showDialog: {
      get() {
        return this.modelValue;
      },
      set(value) {
        this.$emit('update:modelValue', value);
      },
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

  watch: {
    workspace: {
      immediate: true,
      handler(workspace) {
        if (workspace && this.isUpdateMode) {
          this.formData = {
            title: workspace.title || '',
            pfs: workspace.pfs
              ? Array.isArray(workspace.pfs)
                ? workspace.pfs
                : [workspace.pfs]
              : [],
            description: workspace.description || '',
          };
        }
      },
    },

    showDialog(val) {
      if (!val) {
        this.resetForm();
      }
    },
  },

  methods: {
    async handleSubmit() {
      const { valid } = await this.$refs.form.validate();

      if (!valid) return;

      const payload = {
        title: this.formData.title,
        description: this.formData.description || null,
        pfs: this.formData.pfs.length > 0 ? this.formData.pfs : null,
      };

      // Include workspace ID for update mode
      if (this.isUpdateMode && this.workspace) {
        payload.id = this.workspace.id;
      }

      this.$emit('submit', payload);
    },

    handleClose() {
      this.resetForm();
      this.showDialog = false;
    },

    resetForm() {
      if (this.isUpdateMode && this.workspace) {
        // Restore workspace data in update mode
        this.formData = {
          title: this.workspace.title || '',
          pfs: this.workspace.pfs
            ? Array.isArray(this.workspace.pfs)
              ? this.workspace.pfs
              : [this.workspace.pfs]
            : [],
          description: this.workspace.description || '',
        };
        this.$refs.form?.resetValidation();
      } else {
        // Clear form in create mode
        this.formData = {
          title: '',
          pfs: [],
          description: '',
        };
        this.$refs.form?.reset();
      }
    },
  },
};
</script>
