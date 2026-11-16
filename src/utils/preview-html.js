import { mdiCommentOutline } from '@mdi/js';

const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:'];
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const SVG_NS = 'http://www.w3.org/2000/svg';

// The preview's links set e.g. `#edit=<path>` on the editor's URL: WebKit runs no listeners in the
// sandboxed preview (#192)
const HASH_ACTION = /^#(edit|comment|comments)=(.+)$/;

// The browser's button font keeps the links as large as the server's buttons; the last supported
// keyword wins
const LINK_STYLE =
  'float: right; display: inline-block; margin: 0 0 0.5rem 0.5rem; border-radius: 4px;' +
  'text-decoration: none; transition: background-color 0.2s ease;' +
  'font: 13.3333px sans-serif; font: -moz-button; font: -webkit-small-control;';
const EDIT_STYLE = 'padding: 0.3rem 0.8rem; background-color: #007bff; color: white;';
// Hidden until syncCommentMarks() knows whether they apply
const COMMENT_STYLE =
  'display: none; padding: calc(0.3rem - 1px) calc(0.8rem - 1px); border: 1px solid #007bff;' +
  'background-color: white; color: #007bff;';
// Red: open threads are work still to do
const COUNT_STYLE =
  'display: none; padding: 0.3rem 0.6rem; background-color: #b00020; color: white;';
const PREVIEW_STYLE =
  'a.edit:hover, a.edit:focus-visible { background-color: #0069d9 !important; }' +
  'a.comment:hover, a.comment:focus-visible { background-color: #e7f1ff !important; }' +
  'a.comment-count:hover, a.comment-count:focus-visible { background-color: #8c001a !important; }';

// Without the JSON pointer to a field of the file that can follow, e.g. #/background
const fileOf = (path) => path.split('#')[0];

/**
 * The action a preview link set on the editor's URL.
 * @param {string} hash e.g. `#edit=/requirements/foo.yaml`
 * @returns {{action: 'edit'|'comment'|'comments', path: string}|null}
 */
export function parseHashAction(hash) {
  const match = HASH_ACTION.exec(hash);
  return match && { action: match[1], path: fileOf(match[2]) };
}

const isAbsoluteUrl = (url) => URL.parse(url) !== null;

// These could retarget links (<base>, SVG animations) or escape the rewriting below (frames,
// templates that become shadow roots)
function removeUnsafeElements(doc) {
  doc
    .querySelectorAll('base, animate, set, iframe, frame, object, embed, template')
    .forEach((element) => element.remove());
}

// Only the action links may navigate the editor, and only fragments stay in the preview, as a page
// loaded there keeps the sandbox's permissions. Others open in a new tab, javascript: etc. are
// dropped
function retargetLinks(doc) {
  doc.querySelectorAll('a, area').forEach((link) => {
    const href = link.getAttribute('href') ?? link.getAttributeNS(XLINK_NS, 'href');
    if (href === null || href.startsWith('#')) {
      link.setAttribute('target', '_self');
      return;
    }
    const url = URL.parse(href, doc.baseURI);
    if (url && SAFE_PROTOCOLS.includes(url.protocol)) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    } else {
      link.removeAttribute('href');
      link.removeAttributeNS(XLINK_NS, 'href');
      link.removeAttribute('target');
    }
  });
}

function rewriteAssets(doc, assetUrl) {
  const rewrite = (selector, attribute) =>
    doc.querySelectorAll(selector).forEach((element) => {
      const value = element.getAttribute(attribute);
      if (value && !isAbsoluteUrl(value)) {
        element.setAttribute(attribute, assetUrl(value));
      }
    });
  rewrite('img[src]', 'src');
  rewrite('link[rel="stylesheet"]', 'href');
}

function createCommentIcon(doc) {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText =
    'width: 1.2em; height: 1.2em; vertical-align: -0.3em; margin-right: 0.3em; fill: currentColor;';
  const path = doc.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', mdiCommentOutline);
  svg.append(path);
  return svg;
}

// The server's Edit buttons become links that act through the editor's URL, next to links to
// comment on the file and to its open threads. Floated right, so shown right to left
function addActionLinks(doc, pageUrl) {
  const createLink = (className, action, path, style) => {
    const link = doc.createElement('a');
    link.className = className;
    link.dataset.path = path;
    link.href = `${pageUrl}#${action}=${encodeURIComponent(path)}`;
    link.target = '_top';
    link.style.cssText = LINK_STYLE + style;
    return link;
  };
  doc.querySelectorAll('button[class="edit"]').forEach((btn) => {
    const path = btn.getAttribute('value');
    if (!path) {
      return;
    }
    const edit = createLink('edit', 'edit', path, EDIT_STYLE);
    edit.textContent = btn.textContent;
    // Threads are on whole files
    const comment = createLink('comment', 'comment', fileOf(path), COMMENT_STYLE);
    comment.textContent = 'Comment';
    const count = createLink('comment-count', 'comments', fileOf(path), COUNT_STYLE);
    count.append(createCommentIcon(doc), doc.createElement('span'));
    btn.replaceWith(edit, comment, count);
  });
  const style = doc.createElement('style');
  style.textContent = PREVIEW_STYLE;
  doc.head.append(style);
}

/**
 * Make a built preview safe to show in the editor, and add its links. Works on an inert document
 * (DOMParser): once written, closed shadow roots are out of reach.
 * @param {Document} doc
 * @param {Object} options
 * @param {function(string): string} options.assetUrl The URL of a relative asset of the preview.
 * @param {string} options.pageUrl The editor's URL without hash, which the links act through.
 */
export function enhancePreviewHtml(doc, { assetUrl, pageUrl }) {
  removeUnsafeElements(doc);
  retargetLinks(doc);
  rewriteAssets(doc, assetUrl);
  addActionLinks(doc, pageUrl);
}

/**
 * Show the Comment links and the counts of open threads that apply, in a shown preview.
 * @param {Document} doc
 * @param {Object} options
 * @param {function(string): boolean} options.canComment Whether a file can get a new thread.
 * @param {function(string): number} options.openCount The number of open threads on a file.
 * @param {function(number): string} options.countLabel The accessible name of a count.
 */
export function syncCommentMarks(doc, { canComment, openCount, countLabel }) {
  doc.querySelectorAll('a.comment').forEach((link) => {
    link.style.display = canComment(link.dataset.path) ? 'inline-block' : 'none';
  });
  doc.querySelectorAll('a.comment-count').forEach((link) => {
    const count = openCount(link.dataset.path);
    link.style.display = count > 0 ? 'inline-block' : 'none';
    link.querySelector('span').textContent = count;
    link.title = countLabel(count);
    link.setAttribute('aria-label', link.title);
  });
}
