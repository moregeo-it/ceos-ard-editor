// A file with one OGC ModSpec block, e.g. a requirement, as Metanorma documents write it:
//
//   [[req_core_crs]]
//   [requirement]
//   ====
//   [%metadata]
//   identifier:: /req/core/crs
//   part:: The first part.
//   part:: The second part.
//   ====
//
// Only the fields of the form change; anchors, comments, notes after the block and fields the form
// doesn't know stay as they are.

export const KINDS = [
  'requirement',
  'recommendation',
  'permission',
  'requirements_class',
  'conformance_class',
  'abstract_test',
  'conformance_test',
];
// Fields that repeat, one value each
export const LISTS = [
  'part',
  'condition',
  'include',
  'inherit',
  'requirement',
  'abstract-test',
  'conformance-test',
];
export const FIELDS = [
  'identifier',
  'subject',
  'target',
  'classification',
  'statement',
  'test-purpose',
  'test-method',
  ...LISTS,
];

const BLOCK = new RegExp(`^\\[(${KINDS.join('|')})(?:[,\\]])`);
const DELIMITER = /^={4,}\s*$/;
const ENTRY = /^([a-z][a-z0-9-]*)::(?:[ \t]+(.*))?$/;
// Delimited blocks inside a value, e.g. a listing, can contain lines that look like fields
const NESTED = /^(-{2,}|\.{4,}|\*{4,}|_{4,}|\+{4,}|={4,})\s*$/;

const isList = (key) => LISTS.includes(key);

function parseStructure(text) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const blocks = lines.flatMap((line, index) => (BLOCK.test(line) ? [index] : []));
  if (blocks.length !== 1) {
    throw new Error(`Expected one ModSpec block, found ${blocks.length}`);
  }
  const blockLine = blocks[0];
  const kind = lines[blockLine].match(BLOCK)[1];
  let open = blockLine + 1;
  while (open < lines.length && !DELIMITER.test(lines[open])) {
    // A block title, e.g. `.Requirements Class Core`
    if (lines[open].trim() && !lines[open].startsWith('.')) {
      throw new Error('Unexpected content before the block');
    }
    open++;
  }
  const close = lines.findIndex((line, index) => index > open && line === lines[open]);
  if (open >= lines.length || close < 0) {
    throw new Error('The block is not closed');
  }
  let index = open + 1;
  while (index < close && !lines[index].trim()) index++;
  if (lines[index]?.trim() !== '[%metadata]') {
    throw new Error('The block has no [%metadata]');
  }

  const entries = [];
  let nested = null;
  for (index++; index < close; index++) {
    const line = lines[index];
    const entry = nested ? null : line.match(ENTRY);
    if (entry) {
      entries.push({
        key: entry[1],
        inline: entry[2] ?? '',
        rest: [],
        start: index,
        end: index + 1,
      });
      continue;
    }
    if (entries.length === 0) {
      if (line.trim()) throw new Error('Unexpected content before the first field');
      continue;
    }
    const last = entries[entries.length - 1];
    last.rest.push(line);
    last.end = index + 1;
    const delimiter = line.match(NESTED)?.[1];
    if (delimiter) {
      nested = nested === delimiter ? null : (nested ?? delimiter);
    }
  }
  for (const entry of entries) {
    // Blank lines after a field stay when it changes
    entry.end = entry.start + 1 + trimTrailingBlanks(entry.rest).length;
  }
  return { lines, eol, kind, close, entries };
}

function trimTrailingBlanks(lines) {
  const result = [...lines];
  while (result.length && !result[result.length - 1].trim()) result.pop();
  return result;
}

// The text of a field: one line, the content of an attached `--` block, or the raw text
function entryValue({ inline, rest }) {
  const more = trimTrailingBlanks(rest);
  if (more.length === 0) {
    return inline;
  }
  if (!inline && more[0] === '+' && more[1] === '--' && more[more.length - 1] === '--') {
    return more.slice(2, -1).join('\n');
  }
  return [inline, ...more].join('\n');
}

export function parse(text) {
  const { kind, entries } = parseStructure(text);
  const value = { type: kind };
  for (const entry of entries) {
    if (!FIELDS.includes(entry.key)) continue;
    if (isList(entry.key)) {
      (value[entry.key] ??= []).push(entryValue(entry));
    } else if (entry.key in value) {
      throw new Error(`The field ${entry.key} appears more than once`);
    } else {
      value[entry.key] = entryValue(entry);
    }
  }
  return value;
}

/** Whether the text is a file the form can edit; others open in their usual editor. */
export function accepts(text) {
  try {
    parse(text);
    return true;
  } catch {
    return false;
  }
}

// Text with attached blocks or continuations is written as it is, other text with several lines in a `--` block
function entryLines(key, text) {
  const value = String(text ?? '').replace(/\r\n/g, '\n');
  if (!value.includes('\n')) {
    return [value ? `${key}:: ${value}` : `${key}::`];
  }
  const lines = value.split('\n');
  if (lines.some((line) => line === '+' || NESTED.test(line))) {
    return [`${key}:: ${lines[0]}`.trimEnd(), ...lines.slice(1)];
  }
  return [`${key}::`, '+', '--', ...lines, '--'];
}

function sameValue(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    const left = a ?? [];
    const right = b ?? [];
    return left.length === right.length && left.every((item, i) => item === right[i]);
  }
  return (a ?? '') === (b ?? '');
}

export function stringify(value, originalText = '') {
  const structure = parseStructure(originalText);
  const before = parse(originalText);
  // Replacements by line: [start, end, lines]
  const changes = [];
  for (const key of FIELDS) {
    if (sameValue(before[key], value[key])) continue;
    const values = isList(key)
      ? (value[key] ?? []).filter((item) => item !== undefined && item !== null)
      : value[key] === undefined || value[key] === null || value[key] === ''
        ? []
        : [value[key]];
    const existing = structure.entries.filter((entry) => entry.key === key);
    const old = isList(key) ? (before[key] ?? []) : existing.length ? [before[key]] : [];
    // Item by item, so the unchanged ones and the lines around them stay
    existing.forEach((entry, i) => {
      if (i >= values.length) {
        changes.push([entry.start, entry.end, []]);
      } else if (values[i] !== old[i]) {
        changes.push([entry.start, entry.end, entryLines(key, values[i])]);
      }
    });
    const lines = values.slice(existing.length).flatMap((item) => entryLines(key, item));
    if (existing.length) {
      const last = existing[existing.length - 1];
      if (lines.length) changes.push([last.end, last.end, lines]);
    } else if (lines.length) {
      // After the fields that come before it, else at the end of the block
      const earlier = FIELDS.slice(0, FIELDS.indexOf(key));
      const previous = structure.entries.filter((entry) => earlier.includes(entry.key)).pop();
      const at = previous ? previous.end : structure.close;
      changes.push([at, at, lines]);
    }
  }
  const lines = [...structure.lines];
  for (const [start, end, replacement] of changes.sort((a, b) => b[0] - a[0] || b[1] - a[1])) {
    lines.splice(start, end - start, ...replacement);
  }
  return lines.join(structure.eol);
}
