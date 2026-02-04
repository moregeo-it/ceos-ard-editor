<template>
  <v-dialog v-model="internalShow" max-width="500">
    <v-card>
      <v-card-title>Rename {{ itemType }}</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="newName"
          label="New Name"
          :placeholder="placeholder"
          :hint="hint"
          :error-messages="nameError"
          persistent-hint
          variant="outlined"
          density="compact"
          autofocus
          @keyup.enter="handleRename"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="handleCancel">Cancel</v-btn>
        <v-btn color="primary" @click="handleRename" :disabled="!isValid">Rename</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: 'RenameDialog',

  props: {
    show: {
      type: Boolean,
      required: true,
    },
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

  emits: ['update:show', 'rename'],

  data() {
    return {
      newName: '',
    };
  },

  computed: {
    internalShow: {
      get() {
        return this.show;
      },
      set(value) {
        this.$emit('update:show', value);
      },
    },

    isFile() {
      return this.itemType.toLowerCase() === 'file';
    },

    hasExtension() {
      if (!this.newName) return false;
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
      if (!this.newName.trim()) {
        return [];
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
      return (
        this.newName.trim() && this.nameError.length === 0 && this.newName !== this.currentName
      );
    },
  },

  watch: {
    show(newVal) {
      if (newVal) {
        this.newName = this.currentName;
      } else {
        this.reset();
      }
    },
  },

  methods: {
    handleRename() {
      if (!this.isValid) {
        return;
      }

      this.$emit('rename', this.newName.trim());
      this.reset();
      this.internalShow = false;
    },

    handleCancel() {
      this.reset();
      this.internalShow = false;
    },

    reset() {
      this.newName = '';
    },
  },
};
</script>
