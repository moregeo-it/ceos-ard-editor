import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';
import vuetify from './plugins/vuetify';
import { filesEditorSyncPlugin } from './stores/editor';

const app = createApp(App);

const pinia = createPinia();
pinia.use(filesEditorSyncPlugin);
app.use(pinia);
app.use(router);
app.use(vuetify);

app.mount('body');
