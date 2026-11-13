import { Buffer } from 'node:buffer';
import { test, expect, API, WORKSPACE_EVENTS } from './support/mock-api';
import { fieldLabels, optionTexts } from './support/ui';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

const row = (page, name) =>
  page
    .locator('.file-tree-row')
    .filter({ has: page.locator('.file-tree-name').getByText(name, { exact: true }) });

async function openWorkspace(page, path = '/workspaces/ws-1') {
  await page.goto(path);
  await expect(row(page, 'pfs')).toBeVisible();
}

// What the server sends while a request waits for a toolchain to be installed
function preparing(toolchain) {
  return {
    type: 'preview.preparing',
    ts: new Date().toISOString(),
    actor_user_id: null,
    toolchain,
  };
}

async function expand(page, ...names) {
  for (const name of names) {
    await row(page, name).click();
  }
}

async function menuEntries(page, name) {
  await page.getByRole('button', { name: `Actions for ${name}`, exact: true }).click();
  const items = page.locator('.v-overlay--active .v-list-item-title');
  await expect(items.first()).toBeVisible();
  const entries = await items.allTextContents();
  await page.keyboard.press('Escape');
  return entries.map((entry) => entry.trim());
}

async function chooseMenuEntry(page, name, entry) {
  await page.getByRole('button', { name: `Actions for ${name}`, exact: true }).click();
  await page.locator('.v-overlay--active .v-list-item').filter({ hasText: entry }).click();
}

test.describe('File tree', () => {
  test('shows the repository folders', async ({ page }) => {
    await openWorkspace(page);

    await expect(
      page.locator('.file-tree > .file-tree-node > .file-tree-row .file-tree-name'),
    ).toHaveText(['glossary', 'pfs', 'requirements', 'sections', 'README.md']);
  });

  test('the pfs folder only allows adding a PFS', async ({ page }) => {
    await openWorkspace(page);

    expect(await menuEntries(page, 'pfs')).toEqual(['Add New PFS']);
  });

  test('existing PFS folders have no menu', async ({ page }) => {
    await openWorkspace(page);
    await expand(page, 'pfs');

    await expect(row(page, 'NRB')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Actions for NRB', exact: true })).toHaveCount(0);
  });

  test('PFS files can not be renamed or deleted', async ({ page }) => {
    await openWorkspace(page);
    await expand(page, 'pfs', 'NRB');

    expect(await menuEntries(page, 'document.yaml')).toEqual([
      'Open in Source Code Editor',
      'Comment',
      'Download',
    ]);
  });

  test('other files can be renamed and deleted', async ({ page }) => {
    await openWorkspace(page);
    await expand(page, 'requirements', 'general');

    expect(await menuEntries(page, 'unused.yaml')).toEqual([
      'Open in Source Code Editor',
      'Comment',
      'Download',
      'Rename',
      'Delete',
    ]);
  });

  test('folders allow creating, uploading, renaming and deleting', async ({ page }) => {
    await openWorkspace(page);

    expect(await menuEntries(page, 'requirements')).toEqual([
      'Create',
      'Upload',
      'Rename',
      'Delete',
    ]);
  });

  test('a new PFS can be renamed and deleted', async ({ page, api }) => {
    await openWorkspace(page);
    await chooseMenuEntry(page, 'pfs', 'Add New PFS');

    const dialog = page.locator('.v-dialog .v-card');
    expect(await fieldLabels(dialog)).toEqual(['ID', 'Title', 'Type', 'Applies To', 'Base PFS']);
    expect(
      await optionTexts(page, dialog.locator('.v-select').filter({ hasText: 'Type' }).first()),
    ).toEqual(['SAR', 'Optical']);
    expect(
      await optionTexts(page, dialog.locator('.v-select').filter({ hasText: 'Base PFS' })),
    ).toEqual(['NRB: SAR Normalised Radar Backscatter', 'SR: Optical Surface Reflectance']);
    await dialog.getByLabel('ID').fill('ST');
    await dialog.getByLabel('Title').fill('Surface Temperature');
    await dialog.locator('.v-select').filter({ hasText: 'Type' }).first().click();
    await page.locator('.v-overlay--active .v-list-item').filter({ hasText: 'Optical' }).click();
    await dialog.getByRole('button', { name: 'Create' }).click();

    await expect(dialog).toBeHidden();
    const post = api.requests.find((r) => r.method === 'POST' && r.path === '/workspaces/ws-1/pfs');
    expect(JSON.parse(post.body)).toMatchObject({ id: 'ST', title: 'Surface Temperature' });

    // The new PFS document opens, which reveals it in the tree
    await expect(page.locator('.editor-tabs .v-tab--selected')).toContainText('document.yaml');
    expect(await menuEntries(page, 'ST')).toEqual(['Rename', 'Delete']);
  });

  test('deleting a requirement lists the PFS using it', async ({ page }) => {
    await openWorkspace(page);
    await expand(page, 'requirements', 'general');

    await chooseMenuEntry(page, 'metadata-machine-readable.yaml', 'Delete');
    const dialog = page.locator('.v-dialog .v-card');
    await expect(dialog).toContainText('Used in NRB, SR.');
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await chooseMenuEntry(page, 'unused.yaml', 'Delete');
    await expect(dialog).toContainText('unused.yaml');
    await expect(dialog).not.toContainText('Used in');
  });
});

test.describe('Upload', () => {
  const yaml = (name) => ({ name, mimeType: 'text/yaml', buffer: Buffer.from('term: x\n') });

  test('uploads files to a folder', async ({ page, api }) => {
    await openWorkspace(page);
    await chooseMenuEntry(page, 'glossary', 'Upload');

    const dialog = page.locator('.v-dialog .v-card');
    await dialog.locator('input[type=file]').setInputFiles([yaml('new.yaml')]);
    await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('new.yaml');
    await dialog.getByRole('button', { name: 'Upload 1 file' }).click();

    await expect(dialog).toBeHidden();
    expect(api.files.has('/glossary/new.yaml')).toBe(true);
    await expect(row(page, 'new.yaml')).toBeVisible();
  });

  test('warns when a replaced file has unsaved changes', async ({ page }) => {
    await openWorkspace(page);
    await expand(page, 'glossary', 'accuracy.yaml');
    const form = page.locator('.v-window-item--active .json-schema-editor');
    await form.locator('input').first().fill('Precision');

    await chooseMenuEntry(page, 'glossary', 'Upload');
    const dialog = page.locator('.v-dialog .v-card');
    await dialog.locator('input[type=file]').setInputFiles([yaml('accuracy.yaml')]);
    await dialog.getByLabel('A file with this name exists. Replace it').check();
    await dialog.getByRole('button', { name: 'Upload 1 file' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.locator('.v-snackbar')).toContainText(
      'Your unsaved changes to /glossary/accuracy.yaml are kept in the editor',
    );
    await expect(form.locator('input').first()).toHaveValue('Precision');
  });

  test('asks before replacing a file created during the upload', async ({ page, api }) => {
    let socket;
    await page.routeWebSocket(WORKSPACE_EVENTS, (ws) => (socket = ws));
    let release;
    const held = new Promise((resolve) => (release = resolve));
    await page.route(
      (url) => decodeURIComponent(url.pathname).endsWith('/glossary/a.yaml'),
      async (route) => {
        await held;
        await route.fallback();
      },
    );
    await openWorkspace(page);
    await chooseMenuEntry(page, 'glossary', 'Upload');

    const dialog = page.locator('.v-dialog .v-card');
    await dialog.locator('input[type=file]').setInputFiles([yaml('a.yaml'), yaml('b.yaml')]);
    await dialog.getByRole('button', { name: 'Upload 2 files' }).click();
    // Another tab of the owner creates b.yaml while a.yaml uploads
    await expect.poll(() => socket).toBeTruthy();
    api.files.set('/glossary/b.yaml', { content: '' });
    api.status.set('/glossary/b.yaml', 'added');
    const file = api.item('/glossary/b.yaml', false);
    socket.send(
      JSON.stringify({
        type: 'file.created',
        ts: new Date().toISOString(),
        actor_user_id: 'user-1',
        path: file.path,
        file,
      }),
    );
    await expect(dialog.getByText('A file with this name exists. Replace it')).toBeVisible();
    release();

    await expect(page.locator('.v-snackbar')).toContainText('Uploaded 1 file to /glossary');
    await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('b.yaml');
    expect(api.files.has('/glossary/a.yaml')).toBe(true);
    expect(api.requests.some((r) => r.method === 'PUT' && r.path.endsWith('/b.yaml'))).toBe(false);
  });
});

test.describe('Editor', () => {
  test('"Used in" opens the PFS that use a requirement', async ({ page }) => {
    await openWorkspace(page);
    await expand(page, 'requirements', 'general', 'metadata-machine-readable.yaml');

    const usedIn = page.getByRole('button', { name: /Used in/ });
    await expect(usedIn).toHaveText(/Used in\s*2/);
    await usedIn.click();
    const items = page.locator('.v-overlay--active .v-list-item');
    await expect(items).toHaveText(['NRB', 'SR']);
    await items.filter({ hasText: 'SR' }).click();

    await expect(page.locator('.editor-tabs .v-tab--selected')).toContainText('document.yaml');
    await expect(page.locator('.v-window-item--active .cm-content')).toContainText(
      'Surface Reflectance',
    );
  });

  test('files without usage have no "Used in"', async ({ page }) => {
    await openWorkspace(page);
    await expand(page, 'requirements', 'general', 'unused.yaml');

    await expect(page.locator('.v-window-item--active .cm-content')).toContainText('Unused');
    await expect(page.getByRole('button', { name: /Used in/ })).toHaveCount(0);
  });

  test('glossary entries open in the form editor', async ({ page }) => {
    await openWorkspace(page);
    await expand(page, 'glossary', 'accuracy.yaml');

    const form = page.locator('.v-window-item--active .json-schema-editor');
    await expect(form).toBeVisible();
    expect(await fieldLabels(form)).toEqual(['Term', 'Description']);
    await expect(form.locator('input').first()).toHaveValue('Accuracy');
    await expect(form.locator('input').nth(1)).toHaveValue('Closeness of agreement.');
  });

  test('other YAML files open in the source code editor', async ({ page }) => {
    await openWorkspace(page);
    await expand(page, 'pfs', 'NRB', 'document.yaml');

    await expect(page.locator('.v-window-item--active .cm-content')).toContainText(
      'Normalised Radar Backscatter',
    );
    await expect(page.locator('.json-schema-editor')).toHaveCount(0);
  });

  test('shows images and PDFs', async ({ page, api }) => {
    api.files.set('/assets/logo.png', { content: PNG, contentType: 'image/png' });
    api.files.set('/assets/spec.pdf', { content: '%PDF-1.4', contentType: 'application/pdf' });
    await openWorkspace(page);
    await expand(page, 'assets', 'logo.png');

    const image = page.locator('.v-window-item--active img');
    await expect(image).toHaveAttribute('src', /^data:image\/png;/);
    await expect.poll(() => image.evaluate((img) => img.naturalWidth)).toBe(1);

    await row(page, 'spec.pdf').click();
    await expect(page.locator('.v-window-item--active iframe')).toHaveAttribute('src', /^blob:/);
  });

  test('search finds files by content', async ({ page }) => {
    await openWorkspace(page);

    await page
      .getByRole('textbox', { name: 'Search files and folders...' })
      .fill('machine readable');
    await expect(row(page, 'metadata-machine-readable.yaml')).toBeVisible();
    await expect(row(page, 'unused.yaml')).toHaveCount(0);
    await expect(page.locator('.file-tree')).toContainText('Metadata shall be machine readable.');
  });

  test('the header buttons are as tall as the view switch', async ({ page }) => {
    await openWorkspace(page);
    const height = async (locator) => (await locator.boundingBox()).height;
    const toggle = await height(page.locator('.v-app-bar .v-btn-group'));
    expect(await height(page.getByRole('button', { name: 'Share' }))).toBe(toggle);
    expect(await height(page.getByRole('button', { name: 'jdoe' }))).toBe(toggle);
  });

  test('search results and tabs tell files of the same name apart', async ({ page }) => {
    await openWorkspace(page);

    await page.getByRole('textbox', { name: 'Search files and folders...' }).fill('document');
    const results = page.locator('.file-tree-row').filter({ hasText: 'document.yaml' });
    await expect(results.locator('.file-tree-folder-path')).toHaveText(['pfs/NRB', 'pfs/SR']);

    await results.nth(0).click();
    await results.nth(1).click();
    await expect(page.locator('.editor-tabs .v-tab .file-folder')).toHaveText(['· NRB', '· SR']);
  });
});

test.describe('Preview', () => {
  test('builds the selected PFS', async ({ page, api }) => {
    await openWorkspace(page);

    await expect(page.locator('.preview-select .v-chip')).toHaveText(['NRB']);
    expect(await optionTexts(page, page.locator('.preview-select'))).toEqual([
      'NRB: SAR Normalised Radar Backscatter',
      'SR: Optical Surface Reflectance',
    ]);
    const frame = page.frameLocator('.preview-iframe');
    await expect(frame.locator('h1')).toHaveText('NRB preview');
    expect(
      api.requests.some((r) => r.method === 'POST' && r.path === '/workspaces/ws-1/previews'),
    ).toBe(true);
  });

  test('Edit in the preview opens the file', async ({ page }) => {
    await openWorkspace(page);

    await page.frameLocator('.preview-iframe').getByRole('link', { name: 'Edit' }).click();
    await expect(page.locator('.editor-tabs .v-tab--selected')).toContainText('unused.yaml');
    await expect(page).toHaveURL(/\/workspaces\/ws-1$/);
  });

  test('an Edit link opened in a new tab opens the file', async ({ page }) => {
    await openWorkspace(page, '/workspaces/ws-1#edit=%2Frequirements%2Fgeneral%2Funused.yaml');

    await expect(page.locator('.editor-tabs .v-tab--selected')).toContainText('unused.yaml');
    await expect(page).toHaveURL(/\/workspaces\/ws-1$/);
  });

  test('other links in the preview can not navigate the editor', async ({ page, api }) => {
    api.previewHtml =
      '<!doctype html><html><head><base target="_top"></head><body><h1>NRB preview</h1>' +
      '<a href="javascript:top.document.title=\'changed\'" target="_top">Script</a>' +
      '<svg><a href="/workspaces" target="_top"><text y="20">Vector</text></a></svg>' +
      '<svg><a href="#top"><set attributeName="target" to="_top" /><text y="20">Animated</text></a></svg>' +
      '<iframe srcdoc="<a href=/workspaces target=_top>Nested</a>"></iframe>' +
      '<a href="/workspaces" target="_top">Relative</a>' +
      '<a href="//example.com/workspaces" target="_top">Network</a>' +
      '<div><template shadowrootmode="open"><a href="/workspaces" target="_top">Shadow</a></template></div>' +
      '<a href="#top" target="_top">Fragment</a></body></html>';
    await openWorkspace(page);
    const frame = page.frameLocator('.preview-iframe');
    await expect(frame.locator('h1')).toHaveText('NRB preview');
    const title = await page.title();

    await expect(frame.locator('iframe, base, set')).toHaveCount(0);
    await expect(frame.getByText('Shadow')).toHaveCount(0);
    for (const name of ['Vector', 'Relative', 'Network']) {
      await expect(frame.locator('a', { hasText: name })).toHaveAttribute('target', '_blank');
    }
    await expect(frame.getByText('Fragment')).toHaveAttribute('target', '_self');
    await frame.getByText('Script').click();
    await frame.getByText('Animated').click();
    await frame.getByText('Fragment').click();

    await expect(page).toHaveURL(/\/workspaces\/ws-1$/);
    expect(await page.title()).toBe(title);
  });

  test('loads no resources from other hosts', async ({ page, api }) => {
    const leaked = [];
    await page.context().route('https://tracker.example/**', (route) => {
      leaked.push(route.request().url());
      return route.abort();
    });
    await page.route(`${API}/workspaces/ws-1/previews/logo.png`, (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: PNG }),
    );
    api.previewHtml =
      '<!doctype html><html><head>' +
      '<link rel="stylesheet" href="https://tracker.example/style.css">' +
      '<link rel="prefetch" href="https://tracker.example/prefetch">' +
      '<style>@import url(https://tracker.example/import.css);' +
      '@font-face { font-family: Remote; src: url(https://tracker.example/font.woff2); }' +
      'body { font-family: Remote; background: url(https://tracker.example/background.png); }' +
      '</style></head><body><h1>NRB preview</h1>' +
      '<img src="https://tracker.example/pixel.png">' +
      '<img srcset="https://tracker.example/srcset.png 2x">' +
      '<video poster="https://tracker.example/poster.png"></video>' +
      '<img src="logo.png" alt="Logo"></body></html>';
    await openWorkspace(page);
    const frame = page.frameLocator('.preview-iframe');
    await expect(frame.locator('h1')).toHaveText('NRB preview');

    // Relative images still load from the API
    const logo = frame.getByAltText('Logo');
    await expect(logo).toHaveAttribute('src', `${API}/workspaces/ws-1/previews/logo.png`);
    await expect.poll(() => logo.evaluate((img) => img.naturalWidth)).toBe(1);
    const iframe = page.locator('.preview-iframe');
    await expect
      .poll(() => iframe.evaluate((element) => element.contentDocument.readyState))
      .toBe('complete');
    expect(leaked).toEqual([]);
  });

  test('keeps the scroll position when the preview is rebuilt', async ({ page, api }) => {
    let socket;
    await page.routeWebSocket(WORKSPACE_EVENTS, (ws) => (socket = ws));
    const tallPreview = (title) =>
      `<!doctype html><html><head></head><body><h1 style="height: 5000px">${title}</h1></body></html>`;
    api.previewHtml = tallPreview('First build');
    await openWorkspace(page);
    const frame = page.frameLocator('.preview-iframe');
    await expect(frame.locator('h1')).toHaveText('First build');
    const iframe = page.locator('.preview-iframe');
    await iframe.evaluate((element) => element.contentWindow.scrollTo(0, 1200));

    // The owner's other tab rebuilt it
    api.previewHtml = tallPreview('Second build');
    await expect.poll(() => socket).toBeTruthy();
    socket.send(
      JSON.stringify({
        type: 'preview.generated',
        ts: new Date().toISOString(),
        actor_user_id: 'user-1',
        pfs: ['NRB'],
      }),
    );

    await expect(frame.locator('h1')).toHaveText('Second build');
    await expect.poll(() => iframe.evaluate((element) => element.contentWindow.scrollY)).toBe(1200);
  });

  test('keeps the scroll position when a rebuild follows before the last one loaded', async ({
    page,
    api,
  }) => {
    let socket;
    await page.routeWebSocket(WORKSPACE_EVENTS, (ws) => (socket = ws));
    let releaseImage;
    const imageRequested = new Promise((resolve) => {
      page.route('**/previews/slow.png', async (route) => {
        resolve();
        await new Promise((release) => (releaseImage = release));
        await route.fulfill({ status: 404 });
      });
    });
    const tallPreview = (title, extra = '') =>
      `<!doctype html><html><head></head><body><h1 style="height: 5000px">${title}</h1>${extra}</body></html>`;
    const rebuilt = () =>
      socket.send(
        JSON.stringify({
          type: 'preview.generated',
          ts: new Date().toISOString(),
          actor_user_id: 'user-1',
          pfs: ['NRB'],
        }),
      );
    api.previewHtml = tallPreview('First build');
    await openWorkspace(page);
    const frame = page.frameLocator('.preview-iframe');
    await expect(frame.locator('h1')).toHaveText('First build');
    const iframe = page.locator('.preview-iframe');
    await iframe.evaluate((element) => element.contentWindow.scrollTo(0, 1200));

    // The second build's image holds back its load event, so its position is not restored yet
    api.previewHtml = tallPreview('Second build', '<img src="slow.png">');
    await expect.poll(() => socket).toBeTruthy();
    rebuilt();
    await expect(frame.locator('h1')).toHaveText('Second build');
    await imageRequested;

    api.previewHtml = tallPreview('Third build');
    rebuilt();
    await expect(frame.locator('h1')).toHaveText('Third build');
    releaseImage();
    await expect.poll(() => iframe.evaluate((element) => element.contentWindow.scrollY)).toBe(1200);
  });

  test('tells while the tools for the preview are set up', async ({ page }) => {
    let socket;
    await page.routeWebSocket(WORKSPACE_EVENTS, (ws) => (socket = ws));
    let release;
    const held = new Promise((resolve) => (release = resolve));
    await page.route(
      (url) => url.pathname.endsWith('/workspaces/ws-1/previews'),
      async (route) => {
        if (route.request().method() === 'POST') {
          await held;
        }
        await route.fallback();
      },
    );
    await openWorkspace(page);

    // The server installs the toolchain before it builds, and says so to every tab
    await expect.poll(() => socket).toBeTruthy();
    socket.send(JSON.stringify(preparing('ceos-ard-cli-0.5.9')));
    await expect(page.getByText('Setting up the tools')).toBeVisible();

    release();
    await expect(page.frameLocator('.preview-iframe').locator('h1')).toHaveText('NRB preview');
    await expect(page.getByText('Setting up the tools')).toHaveCount(0);
  });

  test('tells while a download waits for the tools', async ({ page }) => {
    let socket;
    await page.routeWebSocket(WORKSPACE_EVENTS, (ws) => (socket = ws));
    let release;
    const held = new Promise((resolve) => (release = resolve));
    await page.route(
      (url) => url.pathname.endsWith('/workspaces/ws-1/download'),
      async (route) => {
        await held;
        await route.fallback();
      },
    );
    await openWorkspace(page);
    await expect(page.frameLocator('.preview-iframe').locator('h1')).toBeVisible();

    await page.getByRole('button', { name: 'PDF', exact: true }).click();
    await expect.poll(() => socket).toBeTruthy();
    socket.send(JSON.stringify(preparing('ceos-ard-cli-0.5.9')));
    await expect(page.getByText('Setting up the tools for the download')).toBeVisible();

    release();
    await expect(page.getByText('Setting up the tools')).toHaveCount(0);
  });

  test("ignores the preparation of other tabs' requests", async ({ page }) => {
    let socket;
    await page.routeWebSocket(WORKSPACE_EVENTS, (ws) => (socket = ws));
    let release;
    const held = new Promise((resolve) => (release = resolve));
    await page.route(
      (url) => url.pathname.endsWith('/workspaces/ws-1/download'),
      async (route) => {
        await held;
        await route.fallback();
      },
    );
    await openWorkspace(page);
    await expect(page.frameLocator('.preview-iframe').locator('h1')).toBeVisible();

    // Another user's download waits while this tab is idle, then this tab downloads
    await expect.poll(() => socket).toBeTruthy();
    socket.send(JSON.stringify(preparing('ceos-ard-cli-0.5.9')));
    await page.getByRole('button', { name: 'PDF', exact: true }).click();
    await expect(page.getByRole('button', { name: 'PDF', exact: true })).toHaveClass(
      /v-btn--loading/,
    );
    await expect(page.getByText('Setting up the tools')).toHaveCount(0);
    release();
  });

  test('offers PDF and Word downloads', async ({ page, api }) => {
    await openWorkspace(page);
    await expect(page.frameLocator('.preview-iframe').locator('h1')).toBeVisible();

    await page.getByRole('button', { name: 'PDF', exact: true }).click();
    await expect
      .poll(() => api.requests.find((r) => r.path === '/workspaces/ws-1/download'))
      .toBeTruthy();
    expect(api.requests.find((r) => r.path === '/workspaces/ws-1/download').search).toContain(
      'pdf',
    );
    await expect(page.getByRole('button', { name: 'Word', exact: true })).toBeEnabled();
  });

  test('asks to select a PFS when there is none', async ({ page, api }) => {
    api.workspaces[0].pfs = [];
    await openWorkspace(page);

    await expect(
      page.getByText('Select at least one PFS from the list above to create a preview.'),
    ).toBeVisible();
  });
});

test.describe('Upstream', () => {
  test('shows when the workspace is behind CEOS-ARD', async ({ page, api }) => {
    api.upstream = { behind_commits: 3, conflicting_files: [] };
    await openWorkspace(page);

    await page.getByRole('button', { name: 'Behind CEOS-ARD' }).click();
    const dialog = page.locator('.v-dialog .v-card');
    await expect(dialog.locator('.v-card-title')).toHaveText('Behind CEOS-ARD');
    await expect(dialog).toContainText('The official CEOS-ARD repository has 3 new commits');
    await expect(dialog.getByRole('link', { name: 'Open on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/jdoe/ceos-ard/tree/workspace/ws-1',
    );
  });

  test('shows conflicts with CEOS-ARD', async ({ page, api }) => {
    api.upstream = { behind_commits: 1, conflicting_files: ['/pfs/NRB/document.yaml'] };
    await openWorkspace(page);

    await expect(
      page.getByText(
        'Some of your changes conflict with newer changes in the CEOS-ARD repository.',
      ),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Conflicts with CEOS-ARD' }).click();
    await expect(page.locator('.v-dialog .v-card-title')).toHaveText('Conflicts with CEOS-ARD');
  });
});

test.describe('Realtime', () => {
  test('resyncs when the first connection failed', async ({ page, api }) => {
    let attempts = 0;
    await page.routeWebSocket(WORKSPACE_EVENTS, (ws) => {
      if (++attempts === 1) {
        ws.close({ code: 1011 });
      }
    });
    await openWorkspace(page);
    await expect.poll(() => attempts, { timeout: 10000 }).toBe(2);

    // The resync reloads the workspace after the initial load
    await expect
      .poll(
        () =>
          api.requests.filter((r) => r.method === 'GET' && r.path === '/workspaces/ws-1').length,
      )
      .toBeGreaterThan(1);
  });
});

test.describe('Propose', () => {
  test('names CEOS-ARD as the target', async ({ page, api }) => {
    api.diffs = [{ path: '/pfs/NRB/document.yaml', status: 'modified' }];
    api.commits = [
      {
        sha: 'abc1234',
        message: 'Update NRB',
        timestamp: '2026-10-02T10:00:00Z',
        author: 'Jane Doe',
      },
    ];
    await page.goto('/workspaces/ws-1/propose');

    await expect(page.locator('.changes-overview')).toContainText(
      'not been sent to the CEOS-ARD GitHub repository yet',
    );
    await expect(page.locator('.pull-request')).toContainText(
      'You can propose your changes to CEOS-ARD now.',
    );
  });

  test('keeps the realtime connection on the way to Propose and back', async ({ page }) => {
    let opened = 0;
    let closed = 0;
    await page.routeWebSocket(WORKSPACE_EVENTS, (ws) => {
      opened++;
      ws.onClose(() => closed++);
    });
    await openWorkspace(page);
    await expect.poll(() => opened).toBe(1);

    await page.getByRole('button', { name: 'Propose' }).click();
    await expect(page.locator('.changes-overview')).toBeVisible();
    await page.getByRole('button', { name: 'Editor' }).click();
    await expect(row(page, 'pfs')).toBeVisible();

    expect(opened).toBe(1);
    expect(closed).toBe(0);
  });

  test("shows the changes of the owner's other tab", async ({ page, api }) => {
    let socket;
    await page.routeWebSocket(WORKSPACE_EVENTS, (ws) => (socket = ws));
    const send = (event) =>
      socket.send(
        JSON.stringify({ ts: new Date().toISOString(), actor_user_id: 'user-1', ...event }),
      );
    await openWorkspace(page);
    await page.getByRole('button', { name: 'Propose' }).click();
    await expect(page.locator('.changes-overview')).toBeVisible();

    // The other tab adds a file, then commits it
    api.files.set('/notes.md', { content: '' });
    api.status.set('/notes.md', 'added');
    api.diffs = [{ path: '/notes.md', status: 'added' }];
    send({ type: 'file.created', path: '/notes.md', file: api.item('/notes.md', false) });
    await expect(page.locator('.changes')).toContainText('notes.md');

    const commit = {
      sha: 'abc1234',
      message: 'Add notes',
      timestamp: '2026-11-04T10:00:00Z',
      author: 'Jane Doe',
    };
    api.status.delete('/notes.md');
    api.diffs = [];
    api.commits = [commit];
    send({ type: 'file.committed', commit, changes: [{ path: '/notes.md', status: 'added' }] });
    await expect(page.getByText('Add notes')).toBeVisible();

    await page.getByRole('button', { name: 'Editor' }).click();
    await expect(row(page, 'notes.md')).toBeVisible();
  });

  test("shows the proposal opened in the owner's other tab", async ({ page, api }) => {
    let socket;
    await page.routeWebSocket(WORKSPACE_EVENTS, (ws) => (socket = ws));
    const send = (proposal) =>
      socket.send(
        JSON.stringify({
          type: 'proposal.updated',
          ts: new Date().toISOString(),
          actor_user_id: 'user-1',
          target_user_id: 'user-1',
          proposal,
        }),
      );
    api.commits = [
      {
        sha: 'abc1234',
        message: 'Update NRB',
        timestamp: '2026-11-04T10:00:00Z',
        author: 'Jane Doe',
      },
    ];
    await page.goto('/workspaces/ws-1/propose');
    const pullRequest = page.locator('.pull-request');
    await expect(pullRequest).toContainText('You can propose your changes to CEOS-ARD now.');
    await expect.poll(() => socket).toBeTruthy();

    const proposal = {
      number: 7,
      url: 'https://github.com/ceos-org/ceos-ard/pull/7',
      title: 'Update NRB',
      description: 'Details',
      state: 'open',
      draft: false,
      detached: false,
    };
    send(proposal);
    await expect(pullRequest).toContainText('Proposal: Update NRB');
    const title = pullRequest.getByLabel('Title of the Proposal');
    await expect(title).toHaveValue('Update NRB');

    // Unsaved edits stay
    await title.fill('My title');
    send({ ...proposal, description: 'More details' });
    await expect(pullRequest.getByLabel('Description of the Proposal')).toHaveValue('Details');
    await expect(title).toHaveValue('My title');
  });

  test("refreshes an open diff after the owner's other tab saved the file", async ({
    page,
    api,
  }) => {
    let socket;
    await page.routeWebSocket(WORKSPACE_EVENTS, (ws) => (socket = ws));
    const diff = (line) => `--- a/notes.md\n+++ b/notes.md\n@@ -1 +1 @@\n-Old line\n+${line}\n`;
    api.files.set('/notes.md', { content: 'First version' });
    api.status.set('/notes.md', 'modified');
    api.diffs = [{ path: '/notes.md', status: 'modified' }];
    api.fileDiffs.set('/notes.md', diff('First version'));
    await page.goto('/workspaces/ws-1/propose');
    await page.locator('.changes-overview .file-path', { hasText: 'notes.md' }).click();
    const changes = page.locator('.diff2html-container');
    await expect(changes).toContainText('First version');
    await expect.poll(() => socket).toBeTruthy();

    api.files.set('/notes.md', { content: 'Second version' });
    api.fileDiffs.set('/notes.md', diff('Second version'));
    socket.send(
      JSON.stringify({
        type: 'file.saved',
        ts: new Date().toISOString(),
        actor_user_id: 'user-1',
        path: '/notes.md',
        file: api.item('/notes.md', false),
      }),
    );
    await expect(changes).toContainText('Second version');
  });

  test('a refresh that started before a commit does not undo it', async ({ page, api }) => {
    let socket;
    await page.routeWebSocket(WORKSPACE_EVENTS, (ws) => (socket = ws));
    api.files.set('/notes.md', { content: '' });
    api.status.set('/notes.md', 'added');
    api.diffs = [{ path: '/notes.md', status: 'added' }];
    await page.goto('/workspaces/ws-1/propose');
    const overview = page.locator('.changes-overview');
    await expect(overview).toContainText('notes.md');
    await expect.poll(() => socket).toBeTruthy();

    // The refresh after the other tab's change gets the list from before the commit, but late
    let releaseList;
    const listRequested = new Promise((resolve) => {
      page.route('**/workspaces/ws-1/diffs', async (route) => {
        if (route.request().method() !== 'GET') {
          return route.fallback();
        }
        const files = api.diffs;
        resolve();
        await new Promise((release) => (releaseList = release));
        await route.fulfill({ json: { files } });
      });
    });
    socket.send(
      JSON.stringify({
        type: 'file.saved',
        ts: new Date().toISOString(),
        actor_user_id: 'user-1',
        path: '/notes.md',
        file: api.item('/notes.md', false),
      }),
    );
    await listRequested;

    await overview.getByLabel('Summary for the changes above').fill('Add notes');
    await overview.getByRole('button', { name: 'Commit Changes' }).click();
    await expect(overview).toContainText('Add notes');
    await expect(overview).toContainText('There is nothing to send to GitHub.');

    releaseList();
    await page.waitForResponse('**/workspaces/ws-1/diffs');
    await expect(overview).toContainText('There is nothing to send to GitHub.');
    await expect(overview).toContainText('Add notes');
  });

  test('reloads the proposal after reconnecting', async ({ page, api }) => {
    let socket;
    await page.routeWebSocket(WORKSPACE_EVENTS, (ws) => (socket = ws));
    api.commits = [
      {
        sha: 'abc1234',
        message: 'Update NRB',
        timestamp: '2026-11-04T10:00:00Z',
        author: 'Jane Doe',
      },
    ];
    await page.goto('/workspaces/ws-1/propose');
    const pullRequest = page.locator('.pull-request');
    await expect(pullRequest).toContainText('You can propose your changes to CEOS-ARD now.');
    await expect.poll(() => socket).toBeTruthy();

    // Opened in the owner's other tab while this one was disconnected
    api.proposal = {
      number: 7,
      url: 'https://github.com/ceos-org/ceos-ard/pull/7',
      title: 'Update NRB',
      description: 'Details',
      state: 'open',
      draft: false,
      detached: false,
    };
    const first = socket;
    first.close({ code: 4009, reason: 'resync' });
    await expect.poll(() => socket !== first).toBe(true);
    await expect(pullRequest).toContainText('Proposal: Update NRB');
  });
});
