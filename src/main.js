import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';
import vuetify from './plugins/vuetify';
import { filesEditorSyncPlugin } from './stores/editor';
import { filesPreviewSyncPlugin } from './stores/preview';

const app = createApp(App);

const pinia = createPinia();
pinia.use(filesEditorSyncPlugin);
pinia.use(filesPreviewSyncPlugin);
app.use(pinia);
app.use(router);
app.use(vuetify);

app.mount('body');
