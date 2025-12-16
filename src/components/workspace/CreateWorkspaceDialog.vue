<script>
import { mdiFolderPlus, mdiFolder, mdiFileDocument, mdiText, mdiClose } from '@mdi/js'

export default {
  name: 'CreateWorkspaceDialog',

  props: {
    modelValue: Boolean,
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
    }
  },

  computed: {
    showDialog: {
      get() {
        return this.modelValue
      },
      set(value) {
        this.$emit('update:modelValue', value)
      },
    },
  },

  methods: {
    async handleSubmit() {
      const { valid } = await this.$refs.form.validate()

      if (!valid) return

      this.$emit('submit', {
        title: this.formData.title,
        pfs: this.formData.pfs,
        description: this.formData.description || undefined,
      })
    },

    handleClose() {
      this.resetForm()
      this.showDialog = false
    },

    resetForm() {
      this.formData = {
        title: '',
        pfs: [],
        description: '',
      }
      this.$refs.form?.reset()
    },
  },

  watch: {
    showDialog(val) {
      if (!val) {
        this.resetForm()
      }
    },
  },
}
</script>

<template>
  <v-dialog v-model="showDialog" max-width="600" persistent>
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon :icon="icons.folderPlus" start></v-icon>
        Create New Workspace
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
          Create Workspace
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
