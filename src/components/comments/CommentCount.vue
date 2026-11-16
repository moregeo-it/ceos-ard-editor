<template>
  <v-chip
    v-if="count > 0"
    size="small"
    :variant="urgent ? 'flat' : 'tonal'"
    :color="urgent ? 'error' : 'primary'"
    :prepend-icon="icons.comment"
    class="comment-count"
    @click.stop="showComments"
    @keydown.enter.stop
    @keydown.space.stop
  >
    {{ count }}
    <v-tooltip activator="parent" location="top">
      {{ label }}
    </v-tooltip>
  </v-chip>
</template>

<script>
import { useCommentsStore } from '@/stores/comments';
import { openThreadsLabel, showFileComments } from '@/utils/comments';
import { mdiCommentOutline } from '@mdi/js';

/** The number of open comment threads on a file; shows them and the file in the editor on click. */
export default {
  name: 'CommentCount',

  props: {
    path: { type: String, required: true },
    // Red, like the preview's counts: open threads still need work
    urgent: { type: Boolean, default: false },
  },

  data() {
    return {
      icons: {
        comment: mdiCommentOutline,
      },
    };
  },

  computed: {
    count() {
      // A file's threads are outdated only while it is deleted, and then still count
      return useCommentsStore().openCount(this.path, true);
    },
    label() {
      return openThreadsLabel(this.count);
    },
  },

  methods: {
    showComments() {
      // E.g. from Propose
      if (this.$route.name !== 'editor') {
        this.$router.push({ name: 'editor' });
      }
      showFileComments(this.path);
    },
  },
};
</script>
