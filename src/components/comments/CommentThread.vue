<template>
  <v-card
    variant="outlined"
    class="comment-thread mb-2"
    :class="{ 'comment-thread--resolved': resolved }"
  >
    <div class="d-flex align-center ga-1 pl-3 pr-1 pt-1">
      <v-icon :icon="icons.file" size="x-small" class="text-subtle flex-shrink-0" />
      <a
        v-if="!thread.outdated"
        href="#"
        class="comment-thread-file text-body-2"
        @click.prevent="openFile"
        ><FilePath :path="thread.path" /><v-tooltip
          activator="parent"
          location="top"
          open-delay="300"
          text="Click to open in the editor"
      /></a>
      <FilePath v-else :path="thread.path" class="comment-thread-file text-body-2 text-subtle" />
      <v-spacer />
      <v-btn
        v-if="canComment"
        icon
        :aria-label="resolved ? 'Reopen thread' : 'Resolve thread'"
        :loading="isChangingStatus"
        size="small"
        variant="text"
        @click="toggleStatus"
      >
        <v-icon :icon="resolved ? icons.reopen : icons.resolve" />
        <v-tooltip activator="parent" location="top">
          {{ resolved ? 'Reopen' : 'Resolve' }}
        </v-tooltip>
      </v-btn>
    </div>
    <div v-if="thread.outdated || resolved" class="d-flex flex-wrap ga-1 px-3">
      <v-chip v-if="thread.outdated" size="x-small" color="warning" variant="tonal">
        File missing
        <v-tooltip activator="parent" location="top">
          The file was deleted or moved. The comments are kept.
        </v-tooltip>
      </v-chip>
      <v-chip v-if="resolved" size="x-small" variant="tonal">Resolved</v-chip>
    </div>
    <div v-if="resolved && thread.resolved_by" class="text-caption text-subtle px-3">
      Resolved by {{ thread.resolved_by.username }} on {{ formatDate(thread.resolved_at) }}
    </div>

    <div v-for="comment in thread.comments" :key="comment.id" class="comment px-3 py-2">
      <div class="d-flex align-center ga-2">
        <v-avatar size="28" class="flex-shrink-0">
          <v-img :src="githubAvatarUrl(comment.author.github_id)" :alt="comment.author.username" />
        </v-avatar>
        <div class="comment-meta flex-grow-1">
          <div class="text-body-2 font-weight-medium text-truncate">
            {{ comment.author.username }}
          </div>
          <div
            class="text-caption text-subtle text-truncate"
            :title="formatDate(comment.created_at)"
          >
            {{ formatDate(comment.created_at) }}<span v-if="comment.edited_at"> (edited)</span>
          </div>
        </div>
        <v-menu v-if="actions(comment).length > 0" location="bottom end">
          <template v-slot:activator="{ props }">
            <v-btn
              v-bind="props"
              :icon="icons.menu"
              :aria-label="`Actions for the comment of ${comment.author.username}`"
              size="x-small"
              variant="text"
            />
          </template>
          <v-list density="compact">
            <v-list-item
              v-for="action in actions(comment)"
              :key="action.id"
              @click="action.handler"
            >
              <template v-slot:prepend>
                <v-icon :icon="action.icon" size="small" :color="action.color" />
              </template>
              <v-list-item-title :class="action.color ? `text-${action.color}` : null">
                {{ action.title }}
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>

      <div v-if="comment.deleted" class="text-body-2 font-italic text-subtle mt-1">
        Comment deleted
      </div>
      <v-form
        v-else-if="canComment && editingId === comment.id"
        class="mt-2"
        @submit.prevent="saveEdit(comment)"
      >
        <v-textarea
          v-model="editBody"
          aria-label="Edit comment"
          :readonly="isSaving"
          auto-grow
          rows="2"
          density="compact"
          variant="outlined"
          hide-details
          autofocus
          @keydown.enter.ctrl.prevent="saveEdit(comment)"
          @keydown.enter.meta.prevent="saveEdit(comment)"
          @keydown.esc.stop="editingId = null"
        />
        <div class="d-flex justify-end ga-2 mt-1">
          <v-btn size="small" variant="text" @click="editingId = null">Cancel</v-btn>
          <v-btn
            size="small"
            color="primary"
            variant="elevated"
            type="submit"
            :loading="isSaving"
            :disabled="!editBody.trim()"
          >
            Save
          </v-btn>
        </div>
      </v-form>
      <div v-else class="comment-body text-body-2 mt-1" v-html="renderMarkdown(comment.body)" />
    </div>

    <v-form v-if="canComment" class="px-3 pb-3" @submit.prevent="sendReply">
      <v-textarea
        v-model="replyBody"
        aria-label="Reply"
        :readonly="isReplying"
        placeholder="Reply…"
        auto-grow
        rows="1"
        density="compact"
        variant="outlined"
        hide-details
        @keydown.enter.ctrl.prevent="sendReply"
        @keydown.enter.meta.prevent="sendReply"
      />
      <div v-if="replyBody.trim()" class="d-flex justify-end ga-2 mt-1">
        <v-btn size="small" variant="text" @click="replyBody = ''">Cancel</v-btn>
        <v-btn size="small" color="primary" variant="elevated" type="submit" :loading="isReplying">
          Reply
        </v-btn>
      </div>
    </v-form>
  </v-card>
</template>

<script>
import { useAuthStore } from '@/stores/auth';
import { useCommentsStore } from '@/stores/comments';
import { useEditorStore } from '@/stores/editor';
import { useNotificationsStore } from '@/stores/notifications';
import { useWorkspacesStore } from '@/stores/workspaces';
import { githubAvatarUrl } from '@/utils/avatars';
import { renderMarkdown } from '@/utils/markdown';
import FilePath from './FilePath.vue';
import {
  mdiCheck,
  mdiDeleteOutline,
  mdiDotsVertical,
  mdiFileDocumentOutline,
  mdiPencilOutline,
  mdiRestore,
} from '@mdi/js';

export default {
  name: 'CommentThread',

  components: {
    FilePath,
  },

  props: {
    thread: { type: Object, required: true },
  },

  data() {
    return {
      icons: {
        delete: mdiDeleteOutline,
        edit: mdiPencilOutline,
        file: mdiFileDocumentOutline,
        menu: mdiDotsVertical,
        reopen: mdiRestore,
        resolve: mdiCheck,
      },
      replyBody: '',
      isReplying: false,
      isChangingStatus: false,
      editingId: null,
      editBody: '',
      isSaving: false,
    };
  },

  computed: {
    commentsStore() {
      return useCommentsStore();
    },
    notificationsStore() {
      return useNotificationsStore();
    },
    workspacesStore() {
      return useWorkspacesStore();
    },
    canComment() {
      return this.workspacesStore.canComment;
    },
    resolved() {
      return this.thread.status === 'resolved';
    },
  },

  methods: {
    githubAvatarUrl,
    renderMarkdown,

    formatDate(date) {
      return date
        ? new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
        : '';
    },

    // By GitHub ID like the server, while it is known (sessions stored by older editors lack it)
    isOwn(comment) {
      const { githubId, userId } = useAuthStore();
      return githubId ? comment.author.github_id === githubId : comment.author.user_id === userId;
    },

    // Authors edit and delete their own comments; the owner deletes any
    actions(comment) {
      if (!this.canComment || comment.deleted) {
        return [];
      }
      return [
        this.isOwn(comment) && {
          id: 'edit',
          title: 'Edit',
          icon: this.icons.edit,
          handler: () => this.startEdit(comment),
        },
        (this.isOwn(comment) || this.workspacesStore.isOwner) && {
          id: 'delete',
          title: 'Delete',
          icon: this.icons.delete,
          color: 'error',
          handler: () => this.requestDelete(comment),
        },
      ].filter(Boolean);
    },

    openFile() {
      useEditorStore().show(this.thread.path);
    },

    async toggleStatus() {
      this.isChangingStatus = true;
      try {
        await this.commentsStore.setStatus(this.thread, this.resolved ? 'open' : 'resolved');
      } catch (error) {
        this.notificationsStore.error(`The thread could not be updated: ${error.message}`);
      } finally {
        this.isChangingStatus = false;
      }
    },

    async sendReply() {
      const body = this.replyBody.trim();
      if (!body || this.isReplying) {
        return;
      }
      this.isReplying = true;
      try {
        await this.commentsStore.reply(this.thread, body);
        this.replyBody = '';
      } catch (error) {
        this.notificationsStore.error(`Your reply could not be sent: ${error.message}`);
      } finally {
        this.isReplying = false;
      }
    },

    startEdit(comment) {
      this.editingId = comment.id;
      this.editBody = comment.body;
    },

    async saveEdit(comment) {
      const body = this.editBody.trim();
      if (!body || this.isSaving) {
        return;
      }
      this.isSaving = true;
      try {
        await this.commentsStore.editComment(this.thread, comment, body);
        if (this.editingId === comment.id) {
          this.editingId = null;
        }
      } catch (error) {
        this.notificationsStore.error(`Your comment could not be saved: ${error.message}`);
      } finally {
        this.isSaving = false;
      }
    },

    requestDelete(comment) {
      const whose = this.isOwn(comment)
        ? 'your comment'
        : `the comment of ${comment.author.username}`;
      const comments = this.thread.comments;
      let outcome = 'The replies stay, and "Comment deleted" is shown instead.';
      if (comment === comments[comments.length - 1]) {
        outcome = comments.slice(0, -1).every((other) => other.deleted)
          ? 'It is removed, and the thread with it.'
          : 'It is removed.';
      }
      this.$root.openDialog('ConfirmDialog', {
        title: 'Delete comment',
        message: `Delete ${whose}? ${outcome} This cannot be undone.`,
        confirmButton: 'Delete',
        confirmButtonColor: 'error',
        onAcceptance: () => this.commentsStore.deleteComment(this.thread, comment),
      });
    },
  },
};
</script>

<style scoped>
.comment-thread--resolved {
  opacity: 0.75;
}
.comment + .comment {
  border-top: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.comment-thread-file {
  min-width: 0;
}
a.comment-thread-file {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}
a.comment-thread-file:hover,
a.comment-thread-file:focus-visible {
  text-decoration: underline;
}
.comment-meta {
  min-width: 0;
  line-height: 1.2;
}
.comment-body {
  overflow-wrap: anywhere;
}
.comment-body :deep(p) {
  margin-bottom: 0.5em;
}
.comment-body :deep(p:last-child) {
  margin-bottom: 0;
}
.comment-body :deep(ul),
.comment-body :deep(ol) {
  padding-left: 1.5em;
}
.comment-body :deep(pre) {
  white-space: pre-wrap;
}
</style>
