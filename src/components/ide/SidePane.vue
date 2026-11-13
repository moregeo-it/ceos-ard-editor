<template>
  <div class="d-flex flex-column fill-height">
    <v-tabs v-model="pane" density="compact" grow :show-arrows="false" class="side-pane-tabs">
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
    <div v-show="pane === 'files'" class="side-pane-content">
      <FilesPane />
    </div>
    <div v-show="pane === 'comments'" class="side-pane-content">
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
      return this.commentsStore.openThreadCount;
    },
  },
};
</script>

<style scoped>
/* grow would also stretch the tabs to the column's height */
.side-pane-tabs {
  flex: 0 0 auto;
}
/* Both tabs fit into a narrow column */
.side-pane-tab {
  min-width: 0 !important;
}
.side-pane-content {
  flex: 1 1 0;
  min-height: 0;
}
</style>
