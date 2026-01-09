<template>
  <v-dialog v-model="internalShow" max-width="500">
    <v-card>
      <v-card-title>Create New</v-card-title>
      <v-card-text>
        <v-radio-group v-model="type" inline class="mb-3">
          <v-radio label="File" value="file"></v-radio>
          <v-radio label="Folder" value="folder"></v-radio>
        </v-radio-group>

        <v-text-field
          v-model="path"
          label="Path (optional)"
          placeholder="e.g., sections/introduction"
          hint="Leave empty to create at root level"
          persistent-hint
          density="compact"
          class="mb-3"
        />

        <v-text-field
          v-model="name"
          label="Name"
          :placeholder="type === 'file' ? 'example.yaml' : 'folder-name'"
          :hint="type === 'file' ? 'File name must include extension (e.g., .yaml, .json)' : ''"
          :error-messages="nameError"
          persistent-hint
          density="compact"
          autofocus
          @keyup.enter="handleCreate"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="handleCancel">Cancel</v-btn>
        <v-btn color="primary" @click="handleCreate" :disabled="!isValid">Create</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: 'CreateFileDialog',

  props: {
    show: {
      type: Boolean,
      required: true,
    },
    initialPath: {
      type: String,
      default: '',
    },
  },

  emits: ['update:show', 'create'],

  data() {
    return {
      type: 'file',
      path: '',
      name: '',
    }
  },

  computed: {
    internalShow: {
      get() {
        return this.show
      },
      set(value) {
        this.$emit('update:show', value)
      },
    },

    hasExtension() {
      if (!this.name) return false
      const parts = this.name.split('.')
      return parts.length > 1 && parts[parts.length - 1].length > 0
    },

    nameError() {
      if (!this.name.trim()) {
        return []
      }
      if (this.type === 'file' && !this.hasExtension) {
        return ['File name must include an extension (e.g., .yaml, .json, .txt)']
      }
      if (this.type === 'folder' && this.hasExtension) {
        return ['Folder names should not include file extensions']
      }
      return []
    },

    isValid() {
      return this.name.trim() && this.nameError.length === 0
    },
  },

  watch: {
    show(newVal) {
      if (!newVal) {
        this.reset()
      } else if (this.initialPath) {
        this.path = this.initialPath
      }
    },
  },

  methods: {
    handleCreate() {
      if (!this.isValid) {
        return
      }

      this.$emit('create', {
        type: this.type,
        path: this.path.trim(),
        name: this.name.trim(),
      })

      this.reset()
      this.internalShow = false
    },

    handleCancel() {
      this.reset()
      this.internalShow = false
    },

    reset() {
      this.type = 'file'
      this.path = ''
      this.name = ''
    },
  },
}
</script>
