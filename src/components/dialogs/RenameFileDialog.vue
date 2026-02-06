<template>
  <v-dialog v-model="show" :max-width="sizes.medium">
    <v-form @submit.prevent="handleRename">
      <v-card>
        <v-card-title>Rename {{ itemType }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model.trim="newName"
            label="New Name"
            :placeholder="placeholder"
            :hint="hint"
            :error-messages="nameError"
            persistent-hint
            variant="outlined"
            density="compact"
            autofocus
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="reject">Cancel</v-btn>
          <v-btn color="primary" type="submit" :disabled="!isValid" variant="elevated"
            >Rename</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-form>
  </v-dialog>
</template>

<script>
import DialogMixin from '@/components/DialogMixin';
export default {
  name: 'RenameFileDialog',
  mixins: [DialogMixin],
  props: {
    currentName: {
      type: String,
      default: '',
    },
    itemType: {
      type: String,
      default: 'Item',
      validator: (value) => ['file', 'folder', 'File', 'Folder', 'Item'].includes(value),
    },
  },
  data() {
    return {
      newName: '',
    };
  },
  computed: {
    isFile() {
      return this.itemType.toLowerCase() === 'file';
    },
    hasExtension() {
      const parts = this.newName.split('.');
      return parts.length > 1 && parts[parts.length - 1].length > 0;
    },
    placeholder() {
      return this.isFile ? 'example.yaml' : 'folder-name';
    },
    hint() {
      return this.isFile
        ? 'File name must include extension (e.g., .yaml, .json)'
        : 'Folder names should not include extensions';
    },
    nameError() {
      if (this.newName.length <= 1) {
        return ['Please provide a name with at least 2 characters'];
      }
      if (this.isFile && !this.hasExtension) {
        return ['File name must include an extension'];
      }
      if (!this.isFile && this.hasExtension) {
        return ['Folder names should not include extensions'];
      }
      return [];
    },
    isValid() {
      return this.nameError.length === 0 && this.newName !== this.currentName;
    },
  },
  created() {
    this.newName = this.currentName;
  },
  methods: {
    handleRename() {
      if (!this.isValid) {
        throw new Error('Please resolve the validation errors before submitting.');
      }
      this.accept(this.newName);
    },
  },
};
</script>
