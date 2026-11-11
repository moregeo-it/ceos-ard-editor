import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import vuetify from 'vite-plugin-vuetify';

// Fills the API into the Content-Security-Policy of index.html
function apiOrigin() {
  let origin;
  return {
    name: 'api-origin',
    configResolved(config) {
      const url = config.env.VITE_API_BASE_URL;
      origin = URL.canParse(url) ? new URL(url).origin : '';
      if (!/^https?:\/\//.test(origin)) {
        throw new Error('VITE_API_BASE_URL must be an absolute http(s) URL');
      }
    },
    transformIndexHtml(html) {
      return html
        .replaceAll('%API_ORIGIN%', origin)
        .replaceAll('%API_SOCKET_ORIGIN%', origin.replace(/^http/, 'ws'));
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [apiOrigin(), vue(), vueDevTools(), vuetify({ autoImport: true })],
  server: {
    // Vuetify's auto-import adds the component imports while transforming files, after the
    // startup scan: without this, Vite finds them one page at a time and reloads the page each time
    warmup: { clientFiles: ['./src/**/*.vue'] },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
