import { test as base, expect } from '@playwright/test';
import { expectNoRawData } from './ui';
// Exported from the server, see README.md
import CEOS_ARD_TYPE from './types/ceos-ard.json' with { type: 'json' };

export const API = 'http://localhost:8099';
// The realtime streams: the open workspace's, and the user's (changes to their workspaces)
export const WORKSPACE_EVENTS = /^ws:\/\/localhost:8099\/workspaces\/[^/]+\/events/;
export const USER_EVENTS = /^ws:\/\/localhost:8099\/events/;

const USER = {
  id: 'user-1',
  username: 'jdoe',
  github_id: '4242',
  full_name: 'Jane Doe',
  identity_provider: 'github',
};

const FILES = {
  '/README.md': '# CEOS-ARD\n',
  '/glossary/accuracy.yaml': 'term: Accuracy\ndescription: Closeness of agreement.\n',
  '/pfs/NRB/document.yaml': 'title: Normalised Radar Backscatter\ntype: SAR\n',
  '/pfs/NRB/requirements.yaml': 'required:\n  - metadata-machine-readable\n',
  '/pfs/SR/document.yaml': 'title: Surface Reflectance\ntype: Optical\n',
  '/pfs/SR/requirements.yaml': 'required:\n  - metadata-machine-readable\n',
  '/requirements/general/metadata-machine-readable.yaml':
    'title: Metadata Machine Readability\ndescription: Metadata shall be machine readable.\n',
  '/requirements/general/unused.yaml': 'title: Unused\ndescription: Not used by any PFS.\n',
  '/sections/introduction/what-are-ceos-ard-products.md': '## What are CEOS-ARD products?\n',
};

const USAGE = {
  '/requirements/general/metadata-machine-readable.yaml': [
    { label: 'NRB', path: '/pfs/NRB/document.yaml' },
    { label: 'SR', path: '/pfs/SR/document.yaml' },
  ],
  '/requirements/general/unused.yaml': [],
};

const PFS_TYPES = [
  { id: 'NRB', title: 'SAR Normalised Radar Backscatter' },
  { id: 'SR', title: 'Optical Surface Reflectance' },
  { id: 'AR', title: 'Aquatic Reflectance' },
];

// With an edit button as the server renders `<!-- edit: path -->`
export const PREVIEW_HTML =
  '<!doctype html><html><head></head><body><h1>NRB preview</h1>' +
  '<a name="/requirements/general/unused.yaml"></a>' +
  '<button class="edit" value="/requirements/general/unused.yaml">Edit</button></body></html>';

// As the server returns it (WorkspaceResponse in app/schemas/workspace.py)
function workspace(overrides = {}) {
  const id = overrides.id ?? 'ws-1';
  return {
    id,
    title: 'NRB review',
    user_id: USER.id,
    pfs: ['NRB'],
    description: 'Review of the NRB PFS',
    fork_repo_owner: 'jdoe',
    fork_repo_name: 'ceos-ard',
    branch_name: `workspace/${id}`,
    type: 'ceos-ard',
    upstream_owner: 'ceos-org',
    upstream_repo: 'ceos-ard',
    upstream_branch: 'main',
    status: 'active',
    pull_request_number: null,
    pull_request_status: null,
    pull_request_status_last_updated_at: null,
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-02T12:00:00Z',
    archived_at: null,
    deletion_at: null,
    viewer_role: 'owner',
    owner_username: USER.username,
    owner_full_name: USER.full_name,
    ...overrides,
  };
}

const AUTHOR = { user_id: USER.id, github_id: USER.github_id, username: USER.username };

/** A comment thread as the server returns it (ThreadResponse in app/schemas/comment.py). */
export function thread({ id = 'thread-1', path, body, author = AUTHOR, ...overrides }) {
  const created = '2026-10-03T09:00:00Z';
  return {
    id,
    workspace_id: 'ws-1',
    path,
    previous_paths: [],
    status: 'open',
    outdated: false,
    created_by: author,
    created_at: created,
    updated_at: created,
    resolved_by: null,
    resolved_at: null,
    comments: [
      { id: `${id}-c1`, author, body, deleted: false, created_at: created, edited_at: null },
    ],
    ...overrides,
  };
}

// The editor and the API are on different origins, as in production
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, X-Client-Id',
};

const fulfill = (route, { headers, ...response }) => {
  const origin = route.request().headers().origin;
  return route.fulfill({
    ...response,
    headers: { ...CORS, 'Access-Control-Allow-Origin': origin ?? '*', ...headers },
  });
};

const json = (route, body, status = 200) =>
  fulfill(route, { status, contentType: 'application/json', body: JSON.stringify(body) });

const parentOf = (path) => path.slice(0, path.lastIndexOf('/')) || '/';
const nameOf = (path) => path.slice(path.lastIndexOf('/') + 1);

/** An in-memory stand-in for the CEOS-ARD server, with a small CEOS-ARD repository. */
export class MockApi {
  constructor() {
    this.files = new Map(Object.entries(FILES).map(([path, content]) => [path, { content }]));
    this.status = new Map();
    this.types = [CEOS_ARD_TYPE];
    this.workspaces = [workspace()];
    this.upstream = null;
    this.previewHtml = PREVIEW_HTML;
    this.diffs = [];
    // Unified diffs by path
    this.fileDiffs = new Map();
    this.commits = [];
    this.proposal = null;
    this.threads = [];
    this.shareModes = ['readonly', 'comment'];
    this.requests = [];
  }

  folders() {
    const folders = new Set();
    for (const path of this.files.keys()) {
      for (let parent = parentOf(path); parent !== '/'; parent = parentOf(parent)) {
        folders.add(parent);
      }
    }
    return folders;
  }

  item(path, isDirectory) {
    return {
      name: nameOf(path),
      path,
      is_directory: isDirectory,
      status: this.status.get(path) ?? null,
    };
  }

  list(path) {
    const items = [];
    for (const folder of this.folders()) {
      if (parentOf(folder) === path) items.push(this.item(folder, true));
    }
    for (const file of this.files.keys()) {
      if (parentOf(file) === path) items.push(this.item(file, false));
    }
    return items.sort(
      (a, b) => b.is_directory - a.is_directory || a.name.localeCompare(b.name, 'en'),
    );
  }

  search(query) {
    const q = query.toLowerCase();
    const results = [];
    for (const [path, { content }] of this.files) {
      if (nameOf(path).toLowerCase().includes(q)) {
        results.push({ ...this.item(path, false), type: 'filename' });
        continue;
      }
      const lines = content.split('\n');
      const line = lines.findIndex((l) => l.toLowerCase().includes(q));
      if (line >= 0) {
        results.push({
          ...this.item(path, false),
          type: 'content',
          line: line + 1,
          column: lines[line].toLowerCase().indexOf(q) + 1,
          excerpt: lines[line],
        });
      }
    }
    return results;
  }

  workspacePfs() {
    const ids = [...this.folders()]
      .filter((folder) => parentOf(folder) === '/pfs')
      .map((folder) => nameOf(folder));
    return {
      pfs_types: ids.map((id) => ({ id, title: PFS_TYPES.find((t) => t.id === id)?.title ?? id })),
    };
  }

  async install(page) {
    const session = { userId: USER.id, username: USER.username, provider: 'github' };
    await page.addInitScript((value) => {
      localStorage.setItem(
        'ceos_ard_editor_session',
        JSON.stringify({ ...value, expiresAt: Date.now() + 8 * 3600 * 1000 }),
      );
    }, session);
    // CSP violations of the editor's own document; the preview's are reported in its frame
    await page.addInitScript(() => {
      window.cspViolations = [];
      document.addEventListener('securitypolicyviolation', (event) => {
        window.cspViolations.push(`${event.effectiveDirective} ${event.blockedURI}`);
      });
    });
    await page.routeWebSocket(new RegExp(`^ws://localhost:8099/`), () => {});
    await page.route(`${API}/**`, (route) => this.handle(route));
  }

  async handle(route) {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = decodeURIComponent(url.pathname);
    if (method === 'OPTIONS') {
      return fulfill(route, { status: 204 });
    }
    this.requests.push({ method, path, search: url.search, body: request.postData() });

    let m;
    if (path === '/auth/user') {
      const expires = new Date(Date.now() + 8 * 3600 * 1000).toISOString();
      return json(route, { ...USER, expires_at: expires });
    }
    if (path === '/types') {
      return json(route, this.types);
    }
    if (path === '/shares/modes') {
      return json(route, this.shareModes);
    }
    if (path === '/pfs') {
      // GitHub only provides the folder names of the PFS
      return json(route, { pfs_types: PFS_TYPES.map(({ id }) => ({ id, title: null })) });
    }
    if (path === '/workspaces') {
      if (method === 'POST') {
        const data = JSON.parse(request.postData());
        const created = workspace({ id: `ws-${this.workspaces.length + 1}`, ...data });
        this.workspaces.push(created);
        return json(route, created, 201);
      }
      return json(route, this.workspaces);
    }
    if ((m = path.match(/^\/workspaces\/([^/]+)(\/.*)?$/))) {
      const ws = this.workspaces.find((w) => w.id === m[1]);
      if (!ws) return json(route, { detail: 'Workspace not found' }, 404);
      return this.handleWorkspace(route, request, method, ws, m[2] ?? '', url);
    }
    return json(route, { detail: `Not mocked: ${method} ${path}` }, 404);
  }

  handleWorkspace(route, request, method, ws, sub, url) {
    let m;
    if (sub === '') {
      if (method === 'PATCH') Object.assign(ws, JSON.parse(request.postData()));
      return json(route, ws);
    }
    if (sub === '/sync') {
      return json(route, {
        status: 'up_to_date',
        ahead_commits: 0,
        behind_commits: 0,
        pulled_commits: 0,
        conflicting_files: [],
        repaired: false,
        upstream: this.upstream,
      });
    }
    if (sub === '/files' && method === 'GET') {
      return json(route, this.list(url.searchParams.get('path') || '/'));
    }
    if (sub === '/files' && method === 'POST') {
      const { path, name, type } = JSON.parse(request.postData());
      const target = `${path === '/' ? '' : path}/${name}`;
      if (type === 'folder') {
        this.files.set(`${target}/.gitkeep`, { content: '' });
      } else {
        this.files.set(target, { content: '' });
      }
      this.status.set(target, 'added');
      return json(route, this.item(target, type === 'folder'), 201);
    }
    if ((m = sub.match(/^\/files\/(.+)$/))) {
      const path = `/${m[1].replace(/^\//, '')}`;
      if (method === 'GET') {
        const file = this.files.get(path);
        if (!file) return json(route, { detail: 'Not found' }, 404);
        const contentType = file.contentType ?? 'text/yaml';
        return fulfill(route, { status: 200, contentType, body: file.content });
      }
      if (method === 'PUT') {
        this.status.set(path, this.files.has(path) ? 'modified' : 'added');
        this.files.set(path, { content: request.postData() });
        return json(route, this.item(path, false));
      }
      if (method === 'DELETE') {
        for (const file of [...this.files.keys()]) {
          if (file === path || file.startsWith(`${path}/`)) this.files.delete(file);
        }
        return fulfill(route, { status: 204 });
      }
      return json(route, this.item(path, false));
    }
    if ((m = sub.match(/^\/context\/(.+)$/))) {
      const path = `/${m[1].replace(/^\//, '')}`;
      return json(route, { ...this.item(path, false), usage: USAGE[path] ?? null });
    }
    if (sub === '/search') {
      return json(route, this.search(url.searchParams.get('query')));
    }
    if (sub === '/pfs' && method === 'GET') {
      return json(route, this.workspacePfs());
    }
    if (sub === '/pfs' && method === 'POST') {
      const { id, title } = JSON.parse(request.postData());
      const document = `/pfs/${id}/document.yaml`;
      this.files.set(document, { content: `title: ${title}\n` });
      this.files.set(`/pfs/${id}/requirements.yaml`, { content: 'required: []\n' });
      this.status.set(document, 'added');
      this.status.set(`/pfs/${id}/requirements.yaml`, 'added');
      return json(route, this.item(document, false), 201);
    }
    if (sub === '/previews' || sub === '/previews/current') {
      return fulfill(route, { status: 200, contentType: 'text/html', body: this.previewHtml });
    }
    if (sub === '/download') {
      return fulfill(route, { status: 200, contentType: 'application/pdf', body: '%PDF-1.4' });
    }
    if (sub === '/diffs' && method === 'PUT') {
      const { message } = JSON.parse(request.postData());
      const commit = {
        sha: `c${this.commits.length + 1}`,
        message,
        timestamp: new Date().toISOString(),
        author: USER.full_name,
      };
      this.commits.unshift(commit);
      this.diffs = [];
      this.status.clear();
      return json(route, commit);
    }
    if (sub === '/diffs') {
      return json(route, { files: this.diffs });
    }
    if (sub.startsWith('/diffs/')) {
      const body = this.fileDiffs.get(sub.slice('/diffs/'.length)) ?? '';
      return fulfill(route, { status: 200, contentType: 'text/plain', body });
    }
    if (sub === '/commits') {
      return json(route, this.commits);
    }
    if (sub === '/threads' || sub.startsWith('/threads/')) {
      return this.handleThreads(route, request, method, sub);
    }
    if (sub === '/proposal') {
      return json(route, this.proposal);
    }
    if (sub === '/collaborators' || sub === '/shares') {
      return json(route, []);
    }
    return json(route, { detail: `Not mocked: ${method} ${sub}` }, 404);
  }

  handleThreads(route, request, method, sub) {
    const [, threadId, , commentId] = sub.split('/').slice(1);
    const data = request.postData() ? JSON.parse(request.postData()) : {};
    const now = new Date().toISOString();
    if (!threadId) {
      if (method === 'POST') {
        const created = thread({ id: `thread-${this.threads.length + 1}`, ...data });
        this.threads.unshift(created);
        return json(route, created, 201);
      }
      return json(route, this.threads);
    }
    const found = this.threads.find((t) => t.id === threadId);
    if (!found) return json(route, { detail: 'Thread not found' }, 404);
    if (!commentId && sub.endsWith('/comments')) {
      const id = `${threadId}-c${found.comments.length + 1}`;
      found.comments.push({
        id,
        author: AUTHOR,
        body: data.body,
        deleted: false,
        created_at: now,
        edited_at: null,
      });
      return json(route, found, 201);
    }
    if (!commentId) {
      const resolved = data.status === 'resolved';
      Object.assign(found, {
        status: data.status,
        resolved_by: resolved ? AUTHOR : null,
        resolved_at: resolved ? now : null,
      });
      return json(route, found);
    }
    const comment = found.comments.find((c) => c.id === commentId);
    if (method === 'PATCH') {
      Object.assign(comment, { body: data.body, edited_at: now });
      return json(route, found);
    }
    if (comment === found.comments.at(-1)) {
      found.comments.pop();
      while (found.comments.at(-1)?.deleted) found.comments.pop();
    } else {
      Object.assign(comment, { body: null, deleted: true });
    }
    if (found.comments.length === 0) {
      this.threads = this.threads.filter((t) => t !== found);
      return fulfill(route, { status: 204 });
    }
    return json(route, found);
  }
}

export const test = base.extend({
  api: [
    async ({ page }, use) => {
      const api = new MockApi();
      await api.install(page);
      await use(api);
      // Whatever a test leaves on screen, e.g. config or API data shown as text
      if (!page.isClosed()) {
        await expectNoRawData(page);
        expect(await page.evaluate(() => window.cspViolations ?? [])).toEqual([]);
      }
    },
    { auto: true },
  ],
});

export { expect };
