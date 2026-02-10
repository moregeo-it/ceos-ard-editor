/**
 * Adapted from enhanced-yaml (https://github.com/paul-soporan/enhanced-yaml)
 * by Paul Soporan, MIT License.
 *
 * Rewritten to use yaml v2 APIs instead of yaml v1.
 * Provides YAML parse/stringify that preserves comments, styling, key order,
 * and original line endings.
 *
 * Uses yaml v2's Document API: parsing into a Document preserves the AST,
 * and doc.set() updates existing keys in-place (preserving their position).
 */

import { Document, parseDocument, isMap } from 'yaml';

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Detect the line ending style used in a string.
 */
function detectLineEnding(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

/**
 * Normalize a result string to match the original's line ending style
 * and trailing-newline behaviour.
 */
function normalizeEndings(result, original) {
  const lineEnding = detectLineEnding(original);
  const endsWithNewline = /\r?\n$/.test(original);

  // Normalize to LF first, then convert to the original style
  let out = result.replace(/\r\n/g, '\n');
  if (lineEnding === '\r\n') {
    out = out.replace(/\n/g, '\r\n');
  }

  // Strip or ensure trailing newline to match the original
  if (!endsWithNewline) {
    out = out.replace(/(\r?\n)+$/, '');
  }

  return out;
}

// ── Recursive in-place update ────────────────────────────────────────

/**
 * Recursively update a YAML Document node from a plain JS value,
 * preserving key order, comments, and scalar styles.
 *
 * - For maps: updates existing keys in-place via doc.setIn(),
 *   deletes removed keys, appends new keys at the end.
 * - For other values: uses doc.setIn() which replaces the node.
 */
function updateNode(doc, path, node, value) {
  if (isMap(node) && typeof value === 'object' && value !== null && !Array.isArray(value)) {
    // Collect existing keys from the YAML map
    const existingKeys = node.items.map((pair) =>
      pair.key && typeof pair.key === 'object' && 'value' in pair.key ? pair.key.value : pair.key,
    );

    // Delete keys that no longer exist in the value
    for (const key of existingKeys) {
      if (!(key in value)) {
        doc.deleteIn([...path, key]);
      }
    }

    // Update existing keys (in-place, preserving position) and add new ones (appended)
    for (const [key, val] of Object.entries(value)) {
      const childPath = [...path, key];
      const childNode = doc.getIn(childPath, true);
      if (
        childNode &&
        isMap(childNode) &&
        typeof val === 'object' &&
        val !== null &&
        !Array.isArray(val)
      ) {
        // Recurse into nested maps
        updateNode(doc, childPath, childNode, val);
      } else {
        // setIn on existing key updates in-place; on new key appends
        doc.setIn(childPath, val);
      }
    }
  } else {
    // Non-map value (scalar, sequence, etc.) — just replace
    if (path.length === 0) {
      doc.contents = doc.createNode(value);
    } else {
      doc.setIn(path, value);
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Parses a YAML string into the corresponding JavaScript value.
 * Key order is preserved (yaml v2's toJSON() maintains source order).
 *
 * @param {string} source The YAML source to load.
 * @returns {unknown} The parsed JavaScript value.
 */
export function load(source) {
  const document = parseDocument(source);
  const firstError = document.errors[0];
  if (firstError) throw firstError;
  return document.toJSON();
}

/**
 * Stringifies a JavaScript value into YAML.
 *
 * When `original` is provided, preserves comments, styling, key order,
 * and line endings from the original YAML source.
 *
 * @param {unknown} value The JavaScript value to dump.
 * @param {object} [options] Dump options (currently: indent).
 * @param {number} [options.indent=2] Indentation width.
 * @param {string} [original] Original YAML string to preserve structure from.
 * @returns {string} The YAML string.
 */
export function dump(value, options = {}, original) {
  const { indent = 2 } = options;

  if (!original) {
    const doc = new Document(value, { indent });
    return doc.toString();
  }

  const doc = parseDocument(original, { indent });
  const firstError = doc.errors[0];
  if (firstError) throw firstError;

  updateNode(doc, [], doc.contents, value);

  return normalizeEndings(doc.toString(), original);
}
