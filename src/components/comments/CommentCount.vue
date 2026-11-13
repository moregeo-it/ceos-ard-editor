<template>
  <v-chip
    v-if="count > 0"
    size="small"
    variant="tonal"
    color="primary"
    :prepend-icon="icons.comment"
    class="comment-count"
    @click.stop="showComments"
    @keydown.enter.stop
    @keydown.space.stop
  >
    {{ count }}
    <v-tooltip activator="parent" location="top">
      {{ count === 1 ? '1 open comment thread' : `${count} open comment threads` }}
    </v-tooltip>
  </v-chip>
</template>

<script>
import { useCommentsStore } from '@/stores/comments';
import { mdiCommentOutline } from '@mdi/js';

/** The number of open comment threads on a file; shows them on click. */
export default {
  name: 'CommentCount',

  props: {
    path: { type: String, required: true },
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
      return useCommentsStore().openCount(this.path);
    },
  },

  methods: {
    showComments() {
      useCommentsStore().showComments(this.path);
    },
  },
};
</script>
