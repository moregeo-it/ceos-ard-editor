<template>
  <div class="file-diff">
    <div v-if="loading" class="text-center">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <div v-else-if="file.status === 'deleted'" class="text-center">
      <p class="text-subtle">The file has been deleted.</p>
    </div>
    <div v-else-if="diff" class="diff2html-container" v-html="formattedDiff"></div>
    <div v-else class="empty-state text-center">
      <p class="text-subtle">No changes have been applied.</p>
    </div>
  </div>
</template>

<script>
import diffService from '@/services/proposal.service';
import { useNotificationsStore } from '@/stores/notifications';
import { useWorkspacesStore } from '@/stores/workspaces';
import { html, parse } from 'diff2html';
import './diff2html.css';

export default {
  name: 'FileDiff',

  props: {
    file: {
      type: Object,
      required: true,
    },
  },

  data() {
    return {
      loading: true,
      diff: null,
    };
  },

  computed: {
    mightHaveDiff() {
      return this.file.status !== 'deleted';
    },
    workspacesStore() {
      return useWorkspacesStore();
    },
    notificationsStore() {
      return useNotificationsStore();
    },
    formattedDiff() {
      const diffJson = parse(this.diff);
      return html(diffJson, {
        drawFileList: false,
        matching: 'lines',
        renderNothingWhenEmpty: false,
        colorScheme: 'auto',
      });
    },
  },

  watch: {
    // The list was refreshed after changes made elsewhere: no spinner, so the panel doesn't jump
    file() {
      this.loadDiff();
    },
  },

  created() {
    this.loadDiff();
  },

  methods: {
    async loadDiff() {
      const request = (this.request = (this.request ?? 0) + 1);
      if (!this.mightHaveDiff) {
        this.loading = false;
        return;
      }
      try {
        const diff = await diffService.fetchDiff(
          this.workspacesStore.currentWorkspace.id,
          this.file.path,
        );
        if (request === this.request) {
          this.diff = diff;
        }
      } catch (error) {
        if (request === this.request) {
          this.diff = '';
          this.notificationsStore.error(
            `Error loading diff for file ${this.file.path}: ${error.message}`,
          );
        }
      } finally {
        if (request === this.request) {
          this.loading = false;
        }
      }
    },
  },
};
</script>
