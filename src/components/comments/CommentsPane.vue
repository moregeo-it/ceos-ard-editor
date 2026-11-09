<template>
  <div class="d-flex flex-column fill-height">
    <div class="d-flex align-center flex-wrap ga-2 px-2 pt-2 flex-shrink-0">
      <v-chip
        v-if="commentsStore.path"
        size="small"
        closable
        :prepend-icon="icons.file"
        :title="commentsStore.path"
        @click:close="commentsStore.showComments(null)"
      >
        {{ pathName }}
      </v-chip>
      <v-btn
        v-if="canStartThread"
        size="small"
        variant="tonal"
        color="primary"
        :prepend-icon="icons.add"
        @click="startThread"
      >
        Comment
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
        <v-icon :icon="icons.info" size="x-small" />
        <v-tooltip activator="parent" location="top" max-width="320">
          {{ visibilityNote }}
        </v-tooltip>
      </span>
    </div>
  </div>
</template>

<script>
import CommentThread from './CommentThread.vue';
import { useCommentsStore } from '@/stores/comments';
import { useFilesStore } from '@/stores/files';
import { useWorkspacesStore } from '@/stores/workspaces';
import { COMMENTS_VISIBILITY_NOTE, openCommentDialog } from '@/utils/comments';
import {
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
  },

  data() {
    return {
      icons: {
        add: mdiCommentPlusOutline,
        comments: mdiCommentMultipleOutline,
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
    pathName() {
      return this.commentsStore.path?.split('/').pop();
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
      const file = useFilesStore().all[this.commentsStore.path];
      return (
        useWorkspacesStore().canComment && file && !file.is_directory && file.status !== 'deleted'
      );
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
