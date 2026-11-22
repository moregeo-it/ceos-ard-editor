<template>
  <div class="changes-overview pa-4 fill-height overflow-auto">
    <h2 class="mb-4">
      List of Changes
      <span v-if="openThreadCount > 0" class="text-body-2 text-subtle ml-2">{{
        openThreadsLabel(openThreadCount)
      }}</span>
    </h2>

    <div v-if="proposalStore.isDiffLoading" class="text-center">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <div v-else-if="diffs.length > 0">
      <p class="mb-4">
        Below you can see a list of changes that you have currently stored in your personal
        workspace, but have <strong>not</strong> been sent to the {{ projectName }} GitHub
        repository yet. Please review the changes and provide a summary message before committing
        them to GitHub.
      </p>
      <v-expansion-panels multiple class="mb-6" v-model="proposalStore.expandedFiles">
        <v-expansion-panel v-for="file in diffs" :key="file.path">
          <v-expansion-panel-title>
            <FileStatusBadge :status="file.status" class="mr-2" width="60px" />
            <template v-if="file.source"
              ><FilePath :path="file.source" class="mr-1" />→&nbsp;</template
            >
            <FilePath :path="file.path" />
            <span class="flex-grow-1" />
            <CommentCount :path="threadPath(file)" urgent class="ml-2 mr-2 flex-shrink-0" />
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <FileDiff :file="file" />
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
      <v-form class="readable-disabled" @submit.prevent="onCommitMessageSubmit">
        <v-text-field
          v-model="proposalStore.commitMessage"
          persistent-counter
          label="Summary for the changes above"
          variant="outlined"
          :counter="maxLengths.commitMessage"
          :disabled="formDisabled"
          class="mb-3"
        ></v-text-field>
        <v-btn
          type="submit"
          color="primary"
          :loading="proposalStore.isCommitting"
          :disabled="formDisabled"
          class="w-100"
          >Commit Changes</v-btn
        >
      </v-form>
    </div>
    <div v-else class="empty-state">
      <p class="text-subtle mt-4">
        No changes have been applied to your workspace.<br />There is nothing to send to GitHub.
      </p>
    </div>
    <template v-if="commits.length > 0">
      <h2 class="mt-4 mb-2">Previous Commits</h2>
      <PreviousCommits />
    </template>
  </div>
</template>

<script>
import { useEditorStore } from '@/stores/editor';
import { usePreviewStore } from '@/stores/preview';
import { useProposalStore } from '@/stores/proposal';
import { useWorkspacesStore } from '@/stores/workspaces';
import { useTypesStore } from '@/stores/types';
import { useNotificationsStore } from '@/stores/notifications';
import { useCommentsStore } from '@/stores/comments';
import { openThreadsLabel } from '@/utils/comments';
import CommentCount from '@/components/comments/CommentCount.vue';
import FilePath from '@/components/FilePath.vue';
import FileStatusBadge from '@/components/FileStatusBadge.vue';
import FileDiff from './FileDiff.vue';
import PreviousCommits from './PreviousCommits.vue';

export default {
  name: 'ChangeList',

  components: {
    CommentCount,
    FilePath,
    FileStatusBadge,
    FileDiff,
    PreviousCommits,
  },

  data() {
    return {
      maxLengths: {
        commitMessage: 500,
      },
    };
  },

  computed: {
    // The name of what the workspace's repository holds, e.g. CEOS-ARD
    projectName() {
      return useTypesStore().currentType?.title;
    },
    editorStore() {
      return useEditorStore();
    },
    previewStore() {
      return usePreviewStore();
    },
    workspacesStore() {
      return useWorkspacesStore();
    },
    notificationsStore() {
      return useNotificationsStore();
    },
    proposalStore() {
      return useProposalStore();
    },
    diffs() {
      return this.proposalStore.diffList;
    },
    commits() {
      return this.proposalStore.commits || [];
    },
    openThreadCount() {
      const comments = useCommentsStore();
      return this.diffs.reduce(
        (sum, file) => sum + comments.openCount(this.threadPath(file), true),
        0,
      );
    },
    formDisabled() {
      return (
        this.proposalStore.isCommitting ||
        this.proposalStore.proposal?.state === 'closed' ||
        this.workspacesStore.isReadOnly
      );
    },
  },

  methods: {
    openThreadsLabel,

    // The diffs' paths are repo-relative, the threads' start with a slash
    threadPath(file) {
      return file.path.startsWith('/') ? file.path : `/${file.path}`;
    },

    async onCommitMessageSubmit() {
      const workspaceId = this.workspacesStore.currentWorkspace.id;
      let commit;

      try {
        // The files store reacts to the file.committed event this emits.
        commit = await this.proposalStore.commitChanges(
          workspaceId,
          this.proposalStore.commitMessage,
        );
      } catch (error) {
        // The commit endpoint only returns 409 when remote changes conflict with the
        // committed changes
        if (error.status === 409) {
          this.$root.openDialog('SyncConflictDialog', {
            workspace: this.workspacesStore.currentWorkspace,
            files: error.details?.detail?.conflicting_files ?? [],
          });
        } else {
          this.notificationsStore.error('Error updating commit: ' + error.message);
        }
        return;
      }

      this.proposalStore.commitMessage = '';
      this.notificationsStore.success(
        commit.merged_remote
          ? 'Commit sent to GitHub. New changes from GitHub were merged into your workspace.'
          : 'Commit updated successfully.',
      );

      // The committed files are refreshed by the file.committed event above; a merge of remote
      // changes touches files beyond the commit, so it needs a full refresh. The commit is
      // already sent: refresh failures must not be reported as commit failures
      try {
        if (commit.merged_remote) {
          await this.editorStore.refreshAfterRemoteUpdate();
          // Due to the commit, a pull from GitHub may happen afterwards that can include changes to the PFS.
          // Drop the preview to ensure it is rebuilt based on the new files.
          this.previewStore.setPreviewHtml('');
          // The merge added commits beyond the one just made
          await this.proposalStore.fetchCommits(workspaceId);
        }
      } catch (error) {
        this.notificationsStore.warning(
          `The commit was sent, but the workspace view could not be refreshed: ${error.message}`,
        );
      }
    },
  },
};
</script>
