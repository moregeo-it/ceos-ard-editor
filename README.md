# CEOS-ARD Editor

[![Lint](https://github.com/ceos-org/ceos-ard-editor/actions/workflows/lint.yml/badge.svg)](https://github.com/ceos-org/ceos-ard-editor/actions/workflows/lint.yml)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

Web-based YAML editor for CEOS Analysis Ready Data (ARD) metadata.

## Features

- 🔐 GitHub OAuth authentication
- 📁 Workspace management
- ✏️ CodeMirror YAML editor
- 📊 diff2html change preview
- 🎨 Vuetify Material Design UI

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Set environment variables

```sh
cp .env.example .env
```

Update the `.env` file accordingly.

The login is a session cookie set by the API, so the editor and the API must run on the same site:
under the same registrable domain (e.g. `editor.ceos-ard.moregeo.it` and `api.ceos-ard.moregeo.it`),
in development both on `localhost` (use `localhost` for both, not `127.0.0.1` for one of them).
Developing in Safari over plain HTTP needs `SESSION_COOKIE_SECURE=false` on the server.

`VITE_APP_TITLE` and `VITE_APP_SUBTITLE` set the name and tagline of a deployment, shown on the landing
page and as the page title.

### Content Security Policy

`index.html` sets a Content-Security-Policy that only allows the editor itself and the API, whose origin
is filled in from `VITE_API_BASE_URL` at build time. The preview inherits it, so a workspace can't make
its viewers load images, styles or fonts from other hosts, e.g. tracking pixels. Images may also come
from `avatars.githubusercontent.com`, for the avatars of the comments. The preview inherits this too, so
workspace content can show GitHub avatars, but only GitHub sees those requests. Styles allow
`'unsafe-inline'` (Vuetify, CodeMirror and the preview use inline styles) and scripts allow `'unsafe-eval'`
(the form editor compiles the JSON schemas with Ajv).

A deployment may also send a CSP header, e.g. to add `frame-ancestors`, which a `<meta>` tag can't set.
Browsers enforce both policies, so a deployment that loads anything else, e.g. analytics from another host,
must extend the policy in `index.html`.

### Workspace types

What differs between the repositories the editor works with, e.g. which files are shown, what the file
menu offers or which files open in a form, is a workspace type defined on the server (see "Workspace Types"
in the ceos-ard-server README). The editor loads the types from `GET /types` into the types store
(`src/stores/types.js`) and doesn't hardcode any of it:

- `src/components/ide/FileContextMenu.vue` builds the file menu from the type's `file_menu` rules and
  `actions`. An action with a `dialog` opens that dialog. Its `requestAction` only runs `CreatePfsDialog`,
  which is also the only dialog the server accepts; a new dialog needs both.
- `src/components/ide/editors/utils.js` picks the form editor of a file from the type's `editors`.
- Globs are matched by `src/utils/glob.js`, like the server's `match_glob`; both have the same test cases.
- Texts name the type instead of CEOS-ARD, e.g. "Behind CEOS-ARD", and the type's `labels` replace
  default texts, e.g. "Used in".
- With more than one type available for new workspaces, the workspace dialog asks for the type, and the
  workspace cards and the header show it.

So the editor has no configuration per type: a new type needs no change in the editor, unless it uses a
dialog the editor doesn't have yet.

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Run End-to-End Tests with [Playwright](https://playwright.dev)

```sh
# Install browsers for the first run
npx playwright install

# Runs the end-to-end tests (headless)
npm run test:e2e
# Runs the tests only on Chromium
npm run test:e2e -- --project=chromium
# Runs the tests of a specific file
npm run test:e2e -- e2e/editor.spec.js
# Shows the browser windows
npm run test:e2e -- --headed
# Runs the tests in debug mode
npm run test:e2e -- --debug
```

The tests mock the API (see `e2e/support/mock-api.js`), so no server is needed. The workspace types of the
mock are exported from the server; update them when the server's types change:

```sh
# In ceos-ard-server
pixi run python scripts/export_types.py ceos-ard > ../ceos-ard-editor/e2e/support/types/ceos-ard.json
```

### Run Unit Tests

```sh
npm run test:unit
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
