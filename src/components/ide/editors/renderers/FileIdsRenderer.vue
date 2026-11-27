<template>
  <v-autocomplete
    v-if="control.visible"
    class="control"
    :model-value="control.data ?? []"
    :items="items"
    :label="computedLabel"
    :hint="control.description"
    :error-messages="control.errors"
    :disabled="!control.enabled"
    :loading="loading"
    :no-data-text="loadError ? `Couldn't load ${folder}: ${loadError}` : `No files in ${folder}`"
    persistent-hint
    multiple
    chips
    closable-chips
    auto-select-first
    clear-on-select
    hide-details="auto"
    @update:model-value="onChange"
  >
    <template v-if="control.enabled" #append>
      <v-btn
        :icon="icons.upload"
        :aria-label="`Upload to ${folder}`"
        :title="`Upload to ${folder}`"
        variant="text"
        size="small"
        @click="upload"
      />
    </template>
  </v-autocomplete>
</template>

<script>
import { and, isControl, rankWith, schemaMatches, uiTypeIs } from '@jsonforms/core';
import { rendererProps, useJsonFormsControl } from '@jsonforms/vue';
import { mdiUpload } from '@mdi/js';
import { useFilesStore } from '@/stores/files';

// Ids named after files, e.g. references/<id>.bib, with the UI schema option
// "files": {"folder": "/references", "extension": "bib"}
const FileIdsRenderer = {
  name: 'FileIdsRenderer',
  props: {
    ...rendererProps(),
  },
  setup(props) {
    return useJsonFormsControl(props);
  },
  data() {
    return {
      loading: false,
      loadError: null,
      icons: {
        upload: mdiUpload,
      },
    };
  },
  computed: {
    filesStore() {
      return useFilesStore();
    },
    folder() {
      return this.control.uischema.options.files.folder.replace(/\/$/, '');
    },
    suffix() {
      return `.${this.control.uischema.options.files.extension}`;
    },
    items() {
      return (this.filesStore.folders[this.folder] ?? [])
        .filter((file) => file.type === 'file' && file.status !== 'deleted')
        .map((file) => file.name)
        .filter((name) => name.endsWith(this.suffix))
        .map((name) => name.slice(0, -this.suffix.length));
    },
    computedLabel() {
      return this.control.required ? `${this.control.label}*` : this.control.label;
    },
  },
  async created() {
    this.loading = true;
    try {
      await this.filesStore.loadFiles(this.folder);
    } catch (error) {
      this.loadError = error.message;
    } finally {
      this.loading = false;
    }
  },
  methods: {
    onChange(values) {
      const ids = [...new Set(values)];
      this.handleChange(this.control.path, ids.length > 0 ? ids : undefined);
    },
    idOf(path) {
      const name = path.slice(path.lastIndexOf('/') + 1);
      return name.endsWith(this.suffix) ? name.slice(0, -this.suffix.length) : null;
    },
    upload() {
      this.$root.openDialog('UploadFilesDialog', {
        folder: this.folder,
        formats: [this.suffix.slice(1)],
        lowercaseExtension: true,
        onUploaded: (paths) => {
          const ids = paths.map((path) => this.idOf(path)).filter(Boolean);
          this.onChange([...(this.control.data ?? []), ...ids]);
        },
      });
    },
  },
};

export default FileIdsRenderer;

// Above StringArrayRenderer, which takes other lists of strings
export const tester = rankWith(
  20,
  and(
    isControl,
    uiTypeIs('Control'),
    schemaMatches((schema) => schema.type === 'array' && schema.items?.type === 'string'),
    (uischema) => !!uischema.options?.files?.folder && !!uischema.options?.files?.extension,
  ),
);
</script>
