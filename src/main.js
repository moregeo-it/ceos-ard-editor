import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';
import vuetify from './plugins/vuetify';
import { setEventErrorHandler } from './services/events';
import { registerFilesEventListeners } from './stores/files';
import { registerEditorEventListeners } from './stores/editor';
import { registerPreviewEventListeners } from './stores/preview';
import { registerWorkspacesEventListeners } from './stores/workspaces';
import { useNotificationsStore } from './stores/notifications';

const app = createApp(App);

const pinia = createPinia();
app.use(pinia);
app.use(router);
app.use(vuetify);

setEventErrorHandler((error) => {
  useNotificationsStore().error('Failed to apply update: ' + error.message);
});
// Registration order carries no meaning: every listener is self-contained (see services/events.js).
registerFilesEventListeners();
registerEditorEventListeners();
registerPreviewEventListeners();
registerWorkspacesEventListeners();

app.mount('body');
