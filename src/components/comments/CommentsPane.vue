<template>
  <div class="d-flex flex-column fill-height">
    <div v-if="commentsStore.path" class="comments-filter mx-2 mt-2 pl-2 pr-1 pt-2 pb-1 rounded">
      <div class="d-flex ga-1 text-caption">
        <v-icon :icon="icons.file" size="small" />
        <div class="comments-filter-text flex-grow-1">
          Showing only comments on
          <FilePath :path="commentsStore.path" class="d-block font-weight-medium" />
        </div>
      </div>
      <div class="d-flex justify-end">
        <v-btn
          size="small"
          variant="text"
          color="primary"
          :prepend-icon="icons.close"
          @click="commentsStore.showComments(null)"
        >
          Show all
        </v-btn>
      </div>
    </div>
    <div class="d-flex align-center flex-wrap ga-2 px-2 pt-2 flex-shrink-0">
      <v-btn
        v-if="canStartThread"
        size="small"
        variant="tonal"
        color="primary"
        :prepend-icon="icons.add"
        @click="startThread"
      >
        Add Comment
      </v-btn>
      <v-spacer />
      <v-switch
        v-if="resolvedCount > 0"
        v-model="showResolved"
        :label="`Resolved (${resolvedCount})`"
        density="compact"
        color="primary"
        hide-details
        class="flex-grow-0"
      />
    </div>

    <div class="flex-grow-1 overflow-y-auto pa-2">
      <div v-if="commentsStore.isLoading && !commentsStore.loaded" class="text-center pa-4">
        <v-progress-circular indeterminate color="primary" />
      </div>
      <div v-else-if="commentsStore.loadFailed && !commentsStore.loaded" class="text-center pa-4">
        <v-icon :icon="icons.error" size="48" color="error" />
        <p class="mt-2">The comments couldn't be loaded.</p>
        <v-btn
          size="small"
          variant="tonal"
          class="mt-2"
          :loading="commentsStore.isLoading"
          @click="commentsStore.reload()"
        >
          Try again
        </v-btn>
      </div>
      <div v-else-if="threads.length === 0" class="text-center text-subtle pa-4">
        <v-icon :icon="icons.comments" size="48" />
        <p class="mt-2">{{ emptyText }}</p>
      </div>
      <CommentThread v-for="thread in threads" :key="thread.id" :thread="thread" />
    </div>

    <div class="d-flex align-center ga-1 text-caption text-subtle px-3 py-1 flex-shrink-0 border-t">
      <v-icon :icon="icons.visibility" size="x-small" />
      <span class="text-truncate">Visible to everyone with access</span>
      <span class="d-inline-flex" tabindex="0" aria-label="Who can see comments">
        <v-icon :icon="icons.info" size="small" />
        <v-tooltip activator="parent" location="top" max-width="320">
          {{ visibilityNote }}
        </v-tooltip>
      </span>
    </div>
  </div>
</template>

<script>
import CommentThread from './CommentThread.vue';
import FilePath from '@/components/FilePath.vue';
import { useCommentsStore } from '@/stores/comments';
import { COMMENTS_VISIBILITY_NOTE, canCommentOn, openCommentDialog } from '@/utils/comments';
import {
  mdiClose,
  mdiCommentAlertOutline,
  mdiCommentMultipleOutline,
  mdiCommentPlusOutline,
  mdiEyeOutline,
  mdiFileDocumentOutline,
  mdiInformationOutline,
} from '@mdi/js';

export default {
  name: 'CommentsPane',

  components: {
    CommentThread,
    FilePath,
  },

  data() {
    return {
      icons: {
        add: mdiCommentPlusOutline,
        close: mdiClose,
        comments: mdiCommentMultipleOutline,
        error: mdiCommentAlertOutline,
        file: mdiFileDocumentOutline,
        info: mdiInformationOutline,
        visibility: mdiEyeOutline,
      },
      showResolved: false,
      visibilityNote: COMMENTS_VISIBILITY_NOTE,
    };
  },

  computed: {
    commentsStore() {
      return useCommentsStore();
    },
    resolvedCount() {
      return this.commentsStore.shownThreads.filter((thread) => thread.status === 'resolved')
        .length;
    },
    threads() {
      const threads = this.commentsStore.shownThreads;
      return this.showResolved ? threads : threads.filter((thread) => thread.status === 'open');
    },
    // A new thread can be started right here when the comments are limited to an existing file
    canStartThread() {
      return canCommentOn(this.commentsStore.path);
    },
    emptyText() {
      if (this.resolvedCount > 0) {
        return 'No open comments.';
      }
      return this.commentsStore.path ? 'No comments here yet.' : 'No comments yet.';
    },
  },

  methods: {
    startThread() {
      openCommentDialog(this.$root, this.commentsStore.path);
    },
  },
};
</script>

<style scoped>
.comments-filter {
  background: rgba(var(--v-theme-primary), 0.08);
}

.comments-filter-text {
  min-width: 0;
}
</style>
