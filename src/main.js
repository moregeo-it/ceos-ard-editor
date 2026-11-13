import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';
import vuetify from './plugins/vuetify';
import { useAuthStore } from './stores/auth';
import { setEventErrorHandler } from './services/events';
import { registerCommentsEventListeners } from './stores/comments';
import { registerFilesEventListeners } from './stores/files';
import { registerEditorEventListeners } from './stores/editor';
import { registerPreviewEventListeners } from './stores/preview';
import { registerWorkspacesEventListeners } from './stores/workspaces';
import { useNotificationsStore } from './stores/notifications';
import { APP_TITLE } from '@/utils/branding';

const app = createApp(App);

const pinia = createPinia();
app.use(pinia);
app.use(router);
app.use(vuetify);

setEventErrorHandler((error) => {
  useNotificationsStore().error('Failed to apply update: ' + error.message);
});
// Registration order carries no meaning: every listener is self-contained (see services/events.js).
registerCommentsEventListeners();
registerFilesEventListeners();
registerEditorEventListeners();
registerPreviewEventListeners();
registerWorkspacesEventListeners();
useAuthStore().listenForOtherTabs();

document.title = APP_TITLE;
app.mount('body');
