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
import 'diff2html/bundles/css/diff2html.min.css';

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
        outputFormat: 'side-by-side',
        renderNothingWhenEmpty: false,
      });
    },
  },

  async created() {
    if (!this.mightHaveDiff) {
      this.loading = false;
      return;
    }
    try {
      this.loading = true;
      this.diff = await diffService.loadDiff(
        this.workspacesStore.currentWorkspace.id,
        this.file.path,
      );
    } catch (error) {
      this.diff = '';
      this.notificationsStore.error(
        `Error loading diff for file ${this.file.path}: ${error.message}`,
      );
    } finally {
      this.loading = false;
    }
  },
};
</script>
