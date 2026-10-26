<template>
  <v-dialog v-model="show" :max-width="sizes.medium" :persistent="uploading">
    <v-form @submit.prevent="upload">
      <v-card>
        <v-card-title>Upload Files</v-card-title>
        <v-card-subtitle>To {{ folder }}</v-card-subtitle>
        <v-card-text>
          <v-file-input
            :model-value="[]"
            :accept="extensions"
            :disabled="uploading"
            label="Choose file(s)"
            :hint="`${formatList} files, up to ${maxSizeMb} MB each`"
            persistent-hint
            multiple
            variant="outlined"
            density="compact"
            class="mb-4"
            @update:model-value="addFiles"
          />

          <v-alert v-if="folderError" type="warning" variant="tonal" density="compact" class="mb-3">
            Couldn't check which files {{ folder }} already has ({{ folderError }}), so nothing can
            be uploaded.
          </v-alert>

          <div v-for="row of rows" :key="row.id" class="mb-3">
            <div class="d-flex align-start">
              <v-text-field
                v-model.trim="row.name"
                :error-messages="row.error ? [...errors(row), row.error] : errors(row)"
                :hint="hint(row)"
                :persistent-hint="!!hint(row)"
                :disabled="uploading"
                :suffix="formatSize(row.file.size)"
                variant="outlined"
                density="compact"
                hide-details="auto"
                @update:model-value="renamed(row)"
              />
              <v-progress-circular
                v-if="row.uploading"
                indeterminate
                size="20"
                width="2"
                class="ml-3 mt-2"
              />
              <v-btn
                v-else
                :icon="icons.remove"
                :disabled="uploading"
                :aria-label="`Remove ${row.name}`"
                variant="text"
                size="small"
                class="ml-1"
                @click="remove(row)"
              />
            </div>
            <v-checkbox
              v-if="exists(row) && errors(row).length === 0"
              v-model="row.replace"
              :disabled="uploading"
              label="A file with this name exists. Replace it"
              density="compact"
              hide-details
            />
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn :disabled="uploading" @click="reject">Cancel</v-btn>
          <v-btn
            color="primary"
            type="submit"
            variant="elevated"
            :disabled="uploadable.length === 0 || loadingFolder || !!folderError"
            :loading="uploading"
          >
            Upload {{ uploadable.length === 1 ? '1 file' : `${uploadable.length} files` }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-form>
  </v-dialog>
</template>

<script>
import DialogMixin from '@/components/DialogMixin';
import { useEditorStore } from '@/stores/editor';
import { useFilesStore } from '@/stores/files';
import { workspaceSession } from '@/services/events';
import { FILE_FORMATS, FORMAT_ERROR, fileFormat, isAllowedFormat } from '@/utils/fileFormats';
import { mdiClose } from '@mdi/js';

// Mirrors the server's rules for new files (app/utils/validation.py)
const MAX_SIZE_MB = 1;
const NAME_PATTERN = /^[\p{L}\p{N}_][\p{L}\p{N}_.-]*[\p{L}\p{N}_]$/u;
// Spaces only in PDF names: nothing links to a PDF, while a Markdown link to an image breaks on one
const PDF_NAME_PATTERN = /^[\p{L}\p{N}_][\p{L}\p{N}_. -]*[\p{L}\p{N}_]$/u;
const IMAGE_FORMATS = ['jpg', 'jpeg', 'png'];

let nextRowId = 0;

export default {
  name: 'UploadFilesDialog',
  mixins: [DialogMixin],
  props: {
    folder: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      rows: [],
      // The workspace this dialog uploads to; it stops once that one is left
      session: workspaceSession(),
      uploading: false,
      loadingFolder: true,
      folderError: null,
      extensions: FILE_FORMATS.map((format) => `.${format}`).join(','),
      formatList: FILE_FORMATS.join(', '),
      maxSizeMb: MAX_SIZE_MB,
      icons: {
        remove: mdiClose,
      },
    };
  },
  computed: {
    filesStore() {
      return useFilesStore();
    },
    uploadable() {
      return this.rows.filter(
        (row) => this.errors(row).length === 0 && (!this.exists(row) || row.replace),
      );
    },
  },
  async created() {
    // The folder's existing files, to ask before replacing one even if it was never expanded
    try {
      await this.filesStore.loadFiles(this.folder);
    } catch (error) {
      this.folderError = error.message;
    } finally {
      this.loadingFolder = false;
    }
  },
  methods: {
    addFiles(files) {
      for (const file of files ?? []) {
        this.rows.push({
          id: nextRowId++,
          file,
          name: file.name,
          replace: false,
          uploading: false,
          error: null,
        });
      }
    },
    remove(row) {
      this.rows = this.rows.filter((other) => other !== row);
    },
    pathOf(row) {
      return `${this.folder.replace(/\/$/, '')}/${row.name}`;
    },
    entryOf(row) {
      const entry = this.filesStore.all[this.pathOf(row)];
      return entry && entry.status !== 'deleted' ? entry : null;
    },
    exists(row) {
      const entry = this.entryOf(row);
      return !!entry && !entry.is_directory;
    },
    errors(row) {
      const { name } = row;
      const pattern = fileFormat(name) === 'pdf' ? PDF_NAME_PATTERN : NAME_PATTERN;
      const errors = [];
      if (!isAllowedFormat(name)) {
        errors.push(FORMAT_ERROR);
      } else if (name.length < 2 || name.length > 100) {
        errors.push('The name must have 2 to 100 characters');
      } else if (!pattern.test(name) || name.includes('..')) {
        errors.push(
          "Use only letters, digits, '-', '_' and '.' (and spaces in PDF names), starting and " +
            'ending with a letter or digit',
        );
      } else if (
        this.rows.some((other) => other !== row && other.name === name && other.id < row.id)
      ) {
        errors.push('This name is already in the list');
      } else if (this.entryOf(row)?.is_directory) {
        errors.push('A folder with this name exists');
      }
      if (row.file.size > MAX_SIZE_MB * 1024 * 1024) {
        errors.push(`The file is larger than ${MAX_SIZE_MB} MB`);
      }
      return errors;
    },
    // Where the build looks for these files
    hint(row) {
      const format = fileFormat(row.name);
      const path = this.pathOf(row);
      if (IMAGE_FORMATS.includes(format) && !path.startsWith('/assets/')) {
        return 'Only images in /assets show in the preview';
      }
      if (format === 'bib' && !path.startsWith('/references/')) {
        return 'Bibliography files belong in /references, named after their entry key';
      }
      return '';
    },
    formatSize(bytes) {
      return bytes < 1024 * 1024
        ? `${Math.max(1, Math.round(bytes / 1024))} KB`
        : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    },
    renamed(row) {
      row.error = null;
      row.replace = false; // the confirmation was for the old name
    },
    // One at a time; uploaded files leave the list, the others stay with the reason
    async upload() {
      const editor = useEditorStore();
      const uploaded = [];
      this.uploading = true;
      for (const row of this.uploadable) {
        if (workspaceSession() !== this.session) {
          break;
        }
        const path = this.pathOf(row);
        row.uploading = true;
        row.error = null;
        try {
          await this.filesStore.save(path, row.file);
        } catch (error) {
          row.error = error.message;
          continue;
        } finally {
          row.uploading = false;
        }
        uploaded.push(path);
        this.remove(row);
        if (editor.changed[path]) {
          this.notifications.warning(`${path} was replaced; its tab keeps its unsaved changes.`);
        } else {
          // A replaced file open in a tab shows the new content; the upload succeeded either way
          await editor
            .sync(path)
            .catch((error) => console.error(`Error reloading ${path}:`, error));
        }
      }
      this.uploading = false;
      if (workspaceSession() !== this.session) {
        this.reject(); // the workspace was left
        return;
      }
      if (uploaded.length) {
        this.filesStore.openedFolders = [
          ...new Set([...this.filesStore.openedFolders, this.folder]),
        ];
        this.notifications.success(
          `Uploaded ${uploaded.length === 1 ? '1 file' : `${uploaded.length} files`} to ${this.folder}`,
        );
      }
      // Rows not uploaded (invalid, failed or not confirmed) keep it open
      if (this.rows.length === 0) {
        this.accept();
      }
    },
  },
};
</script>
