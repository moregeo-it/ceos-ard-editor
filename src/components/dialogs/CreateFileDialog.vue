<template>
  <v-dialog v-model="show" :max-width="sizes.medium">
    <v-form @submit.prevent="handleCreate">
      <v-card>
        <v-card-title>Create New</v-card-title>
        <v-card-text>
          <v-radio-group v-model="type" inline class="mb-3">
            <v-radio label="File" value="file"></v-radio>
            <v-radio label="Folder" value="folder"></v-radio>
          </v-radio-group>

          <v-text-field
            v-model.trim="path"
            variant="outlined"
            label="Path (optional)"
            placeholder="e.g., sections/introduction"
            hint="Leave empty to create at root level"
            persistent-hint
            density="compact"
            class="mb-3"
          />

          <v-text-field
            v-model.trim="name"
            variant="outlined"
            label="Name"
            :placeholder="type === 'file' ? 'example.yaml' : 'folder-name'"
            :hint="type === 'file' ? 'File name must include extension (e.g., .yaml, .json)' : ''"
            :error-messages="nameError"
            persistent-hint
            density="compact"
            autofocus
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="reject">Cancel</v-btn>
          <v-btn color="primary" type="submit" :disabled="!isValid" variant="elevated"
            >Create</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-form>
  </v-dialog>
</template>

<script>
import DialogMixin from '@/components/DialogMixin';

export default {
  name: 'CreateFileDialog',
  mixins: [DialogMixin],
  props: {
    initialPath: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      type: 'file',
      path: '',
      name: '',
    };
  },
  computed: {
    hasExtension() {
      const parts = this.name.split('.');
      return parts.length > 1 && parts[parts.length - 1].length > 0;
    },
    nameError() {
      if (this.name.length <= 1) {
        return ['Please provide a name with at least 2 characters'];
      }
      if (this.type === 'file' && !this.hasExtension) {
        return ['File name must include an extension (e.g., .yaml, .json, .txt)'];
      }
      if (this.type === 'folder' && this.hasExtension) {
        return ['Folder names should not include file extensions'];
      }
      return [];
    },
    isValid() {
      return this.nameError.length === 0;
    },
  },
  created() {
    this.path = this.initialPath;
  },
  methods: {
    handleCreate() {
      if (!this.isValid) {
        throw new Error('Please resolve the validation errors before submitting.');
      }

      this.accept({
        type: this.type,
        path: this.path,
        name: this.name,
      });
    },
  },
};
</script>
