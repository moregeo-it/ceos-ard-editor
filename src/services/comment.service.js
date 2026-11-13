import { api } from '@/utils/api';

const threadsUrl = (workspaceId) => `/workspaces/${workspaceId}/threads`;
const threadUrl = (workspaceId, threadId) => `${threadsUrl(workspaceId)}/${threadId}`;
const commentUrl = (workspaceId, threadId, commentId) =>
  `${threadUrl(workspaceId, threadId)}/comments/${commentId}`;

/** Comment threads on the files of a workspace. Every change resolves to the whole thread. */
export default {
  /** All threads of the workspace, newest first. Everyone with access. */
  async listThreads(workspaceId) {
    return api.get(threadsUrl(workspaceId));
  },

  /** Start a thread on a file with its first comment. Owner and commenters. */
  async createThread(workspaceId, path, body) {
    return api.post(threadsUrl(workspaceId), { path, body });
  },

  /** Resolve or reopen a thread ('resolved' | 'open'). Owner and commenters. */
  async setThreadStatus(workspaceId, threadId, status) {
    return api.patch(threadUrl(workspaceId, threadId), { status });
  },

  /** Reply to a thread. Owner and commenters. */
  async addComment(workspaceId, threadId, body) {
    return api.post(`${threadUrl(workspaceId, threadId)}/comments`, { body });
  },

  /** Change the text of one's own comment. */
  async editComment(workspaceId, threadId, commentId, body) {
    return api.patch(commentUrl(workspaceId, threadId, commentId), { body });
  },

  /** Delete one's own comment, or any as the owner. Resolves to null when the thread went with it. */
  async deleteComment(workspaceId, threadId, commentId) {
    return api.delete(commentUrl(workspaceId, threadId, commentId));
  },
};
