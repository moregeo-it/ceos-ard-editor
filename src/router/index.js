import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useEditorStore } from '@/stores/editor';
import { useFilesStore } from '@/stores/files';
import { useNotificationsStore } from '@/stores/notifications';
import { usePreviewStore } from '@/stores/preview';
import { useProposalStore } from '@/stores/proposal';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: () => import('@/views/LandingView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: () => import('@/views/AuthCallbackView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/workspaces',
      name: 'workspaces',
      component: () => import('@/views/WorkspacesView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/workspaces/:id',
      name: 'editor',
      component: () => import('@/views/PfsEditorView.vue'),
      meta: { requiresAuth: true },
    },
  ],
});

const resetStore = () => {
  // Reset relevant stores on route change
  useEditorStore().reset();
  useFilesStore().reset();
  useNotificationsStore().reset();
  usePreviewStore().reset();
  useProposalStore().reset();
};

router.beforeEach(async (to, from, next) => {
  if (to.name !== from.name) {
    resetStore();
  }

  // Try to restore session on first load
  const authStore = useAuthStore();
  if (!authStore.isAuthenticated && !authStore.isLoading) {
    await authStore.restoreSession();
  }

  // Check authentication requirement
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'landing' });
  } else if (to.name === 'landing' && authStore.isAuthenticated) {
    next({ name: 'workspaces' });
  } else {
    next();
  }
});

export default router;
