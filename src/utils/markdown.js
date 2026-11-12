import DOMPurify from 'dompurify';
import { Marked } from 'marked';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (text) => text.replace(/[&<>"']/g, (char) => ESCAPES[char]);

// HTML in comments is shown as written, not interpreted
const marked = new Marked({
  gfm: true,
  breaks: true,
  async: false,
  renderer: {
    html({ text, block }) {
      return block
        ? `<p>${escapeHtml(text.trim()).replace(/\n/g, '<br>')}</p>\n`
        : escapeHtml(text);
    },
  },
});

// Links in comments open in a new tab, so the workspace stays open
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/**
 * Markdown written by users as safe HTML; line breaks are kept like in a chat message. DOMPurify
 * still removes what Markdown itself can produce, e.g. `javascript:` links.
 */
export function renderMarkdown(text) {
  return DOMPurify.sanitize(marked.parse(text ?? ''), { ADD_ATTR: ['target'] });
}
