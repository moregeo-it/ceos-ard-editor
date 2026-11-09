import DOMPurify from 'dompurify';
import { marked } from 'marked';

// Links in comments open in a new tab, so the workspace stays open
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/**
 * Markdown written by users as safe HTML. Comments come from other people, so the HTML is always
 * sanitized; line breaks are kept like in a chat message.
 */
export function renderMarkdown(text) {
  const html = marked.parse(text ?? '', { gfm: true, breaks: true, async: false });
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
}
