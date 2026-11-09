<template>
  <div class="d-flex flex-column fill-height">
    <!-- Not growing: v-tabs with grow would also fill the column's height -->
    <v-tabs
      v-model="pane"
      density="compact"
      grow
      :show-arrows="false"
      class="flex-grow-0 flex-shrink-0"
    >
      <v-tab value="files" class="side-pane-tab text-none">Files</v-tab>
      <v-tab value="comments" class="side-pane-tab text-none">
        Comments
        <v-badge
          v-if="openCount > 0"
          :content="openCount"
          color="primary"
          inline
          :aria-label="`${openCount} open`"
        />
      </v-tab>
    </v-tabs>
    <!-- Kept alive, so the tree keeps its loaded folders, search and expansion -->
    <div v-show="pane === 'files'" class="side-pane-content">
      <FilesPane />
    </div>
    <div v-if="pane === 'comments'" class="side-pane-content">
      <CommentsPane />
    </div>
  </div>
</template>

<script>
import CommentsPane from '@/components/comments/CommentsPane.vue';
import FilesPane from './FilesPane.vue';
import { useCommentsStore } from '@/stores/comments';

/** The left column: the files, or the comments of the workspace. */
export default {
  name: 'SidePane',

  components: {
    CommentsPane,
    FilesPane,
  },

  computed: {
    commentsStore() {
      return useCommentsStore();
    },
    pane: {
      get() {
        return this.commentsStore.pane;
      },
      set(pane) {
        if (pane === 'comments') {
          this.commentsStore.showComments(this.commentsStore.path);
        } else {
          this.commentsStore.showFiles();
        }
      },
    },
    openCount() {
      return this.commentsStore.openThreads.length;
    },
  },
};
</script>

<style scoped>
/* Both tabs fit into a narrow column */
.side-pane-tab {
  min-width: 0 !important;
}
.side-pane-content {
  flex: 1 1 0;
  min-height: 0;
}
</style>
