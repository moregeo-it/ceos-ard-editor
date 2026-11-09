import { useCommentsStore } from '@/stores/comments';
import { APP_TITLE } from '@/utils/branding';

/** Who can read comments, shown in the comments pane and the share dialog. */
export const COMMENTS_VISIBILITY_NOTE =
  'Comments are visible to everyone this workspace is shared with. Once the workspace owner ' +
  'submits the changes as a proposal (pull request), comments may also become visible to other ' +
  `users of the ${APP_TITLE}.`;

/**
 * Ask for the first comment of a new thread on a file, then show the file's comments.
 * @param {Object} root The root component (`this.$root`), which opens dialogs.
 * @param {string} path The file, e.g. `/requirements/foo.yaml`.
 */
export function openCommentDialog(root, path) {
  root.openDialog('CommentDialog', {
    path,
    onAcceptance: async (body) => {
      const comments = useCommentsStore();
      await comments.createThread(path, body);
      comments.showComments(path);
    },
  });
}
