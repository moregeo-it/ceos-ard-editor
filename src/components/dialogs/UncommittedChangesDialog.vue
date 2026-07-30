<template>
  <v-dialog v-model="show" :max-width="sizes.medium">
    <v-card>
      <v-card-title>Uncommitted Changes</v-card-title>
      <v-card-text>
        <div class="mt-2">
          This workspace has changes that have not been sent to GitHub yet. They stay in your
          workspace, but for as long as they are not committed, changes made on GitHub in the
          meantime can end up conflicting with them.
        </div>
        <template v-if="files.length">
          <div class="mt-4 font-weight-medium">Changes not sent to GitHub:</div>
          <ul class="file-list mt-1">
            <li v-for="file of files" :key="file.path" class="d-flex align-center mb-1">
              <FileStatusBadge :status="file.status" class="mr-2" width="60px" />
              <code>{{ file.path }}</code>
            </li>
          </ul>
        </template>
      </v-card-text>
      <v-card-actions>
        <v-btn
          v-if="onReview"
          color="primary"
          variant="elevated"
          :prepend-icon="icons.propose"
          @click="review"
        >
          Review &amp; Commit
        </v-btn>
        <v-spacer />
        <v-btn @click="reject">Cancel</v-btn>
        <v-btn color="error" :loading="accepting" @click="accept">Close Anyway</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import DialogMixin from '@/components/DialogMixin';
import FileStatusBadge from '@/components/FileStatusBadge.vue';
import { mdiCheckCircle } from '@mdi/js';

export default {
  name: 'UncommittedChangesDialog',
  mixins: [DialogMixin],
  components: {
    FileStatusBadge,
  },
  props: {
    files: {
      type: Array,
      default: () => [],
    },
    onReview: {
      type: Function,
      default: null,
    },
  },
  data() {
    return {
      icons: {
        propose: mdiCheckCircle,
      },
    };
  },
  methods: {
    async review() {
      if (typeof this.onReview === 'function') {
        await this.onReview();
      }
      this.reject();
    },
  },
};
</script>

<style scoped>
.file-list {
  max-height: 200px;
  overflow-y: auto;
  list-style: none;
}
</style>
