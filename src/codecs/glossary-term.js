import { Document, isScalar, parse as parseYaml, parseDocument } from 'yaml';

// Must match the CEOS EO Glossary: its site and export scripts parse this layout with regexes
const FRONT_MATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const DEFINITION_HEADING = /^## \d+ Definition[ \t]*$/gm;
const SECTION_HEADING = /^### (Notes|Examples|Sources)[ \t]*$/m;
const SEPARATOR = /\n_{3,}[ \t]*\s*$/;
const SYNONYMS = /^\*\*Synonyms\*\*:[ \t]*(.*)$/m;
const SECTIONS = ['notes', 'examples', 'sources'];

export const CLASSES = ['base', 'core', 'controversial', 'high-impact'];
export const STATUSES = ['to be defined', 'to be discussed', 'to be approved', 'approved'];
export const GROUPS = ['WGISS', 'WGCV', 'WGCapD', 'LSI-VC', 'WGClimate', 'B-VC', 'AC-VC'];

// Some terms have quoted values spanning lines without indentation, which js-yaml accepts
function lenientYaml(source) {
  const closes = /(^|[^\\])"\s*$/;
  let open = false;
  return source
    .split(/\r?\n/)
    .map((line) => {
      if (open) {
        open = !closes.test(line);
        return `  ${line}`;
      }
      const value = line.match(/^[\w-]+:\s*"(.*)$/);
      open = Boolean(value) && !closes.test(value[1]);
      return line;
    })
    .join('\n');
}

function loadYaml(source) {
  try {
    return parseYaml(source);
  } catch (error) {
    const fixed = lenientYaml(source);
    if (fixed === source) {
      throw error;
    }
    return parseYaml(fixed);
  }
}

function loadYamlDocument(source) {
  const doc = parseDocument(source);
  return doc.errors.length > 0 ? parseDocument(lenientYaml(source)) : doc;
}

const trimNewlines = (text) =>
  text.replace(/^(?:[ \t]*\r?\n)+/, '').replace(/(?:\r?\n[ \t]*)+$/, '');

function splitFile(text) {
  const match = text.match(FRONT_MATTER);
  if (!match) {
    return { frontMatterText: '', frontMatter: {}, body: text };
  }
  const frontMatter = loadYaml(match[1]) ?? {};
  if (typeof frontMatter !== 'object' || Array.isArray(frontMatter)) {
    throw new Error('The front matter is not a key-value map');
  }
  return { frontMatterText: match[0], frontMatter, body: text.slice(match[0].length) };
}

function splitBody(body) {
  const starts = [...body.matchAll(DEFINITION_HEADING)].map((match) => match.index);
  if (starts.length === 0) {
    return { prefix: body, blocks: [] };
  }
  const blocks = starts.map((start, i) => {
    const raw = body.slice(start, starts[i + 1] ?? body.length);
    return raw.replace(SEPARATOR, '').trimEnd();
  });
  return { prefix: body.slice(0, starts[0]), blocks };
}

function parseBlock(raw) {
  const content = raw.slice(raw.indexOf('\n') + 1);
  const parts = content.split(SECTION_HEADING);
  const definition = { definition: trimNewlines(parts[0]), notes: '', examples: '', sources: '' };
  for (let i = 1; i < parts.length - 1; i += 2) {
    definition[parts[i].toLowerCase()] = trimNewlines(parts[i + 1]);
  }
  return definition;
}

function normalizeDefinition(definition = {}) {
  const result = { definition: definition.definition ?? '' };
  SECTIONS.forEach((key) => (result[key] = definition[key] ?? ''));
  return result;
}

function sameDefinition(a, b) {
  return ['definition', ...SECTIONS].every((key) => (a[key] ?? '') === (b[key] ?? ''));
}

function sameList(a = [], b = []) {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

/** The term as the form shows it. */
export function parse(text) {
  const { frontMatter, body } = splitFile(text);
  const tags = (Array.isArray(frontMatter.tags) ? frontMatter.tags : []).map(String);
  const firstClass = tags.find((tag) => CLASSES.includes(tag));
  const firstStatus = tags.find((tag) => STATUSES.includes(tag));
  const synonyms = body.match(SYNONYMS);
  const { blocks } = splitBody(body);
  return {
    title: String(frontMatter.title ?? ''),
    description: String(frontMatter.description ?? ''),
    class: firstClass ?? '',
    status: firstStatus ?? '',
    groups: tags.filter((tag) => GROUPS.includes(tag)),
    synonyms: synonyms
      ? synonyms[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    definitions: blocks.map(parseBlock),
    // Further class and status tags are kept as other tags
    other_tags: tags.filter(
      (tag) => !GROUPS.includes(tag) && tag !== firstClass && tag !== firstStatus,
    ),
  };
}

// Keeps the original order of the tags, so changing one tag changes one line
function buildTags(original, value) {
  const groups = value.groups ?? [];
  const others = value.other_tags ?? [];
  const tags = [];
  let hasClass = false;
  let hasStatus = false;
  for (const tag of original) {
    if (CLASSES.includes(tag) && !hasClass) {
      if (value.class) tags.push(value.class);
      hasClass = true;
    } else if (STATUSES.includes(tag) && !hasStatus) {
      if (value.status) tags.push(value.status);
      hasStatus = true;
    } else if (GROUPS.includes(tag) ? groups.includes(tag) : others.includes(tag)) {
      tags.push(tag);
    }
  }
  const head = [];
  if (!hasClass && value.class) head.push(value.class);
  if (!hasStatus && value.status) head.push(value.status);
  const added = [...groups, ...others].filter((tag) => !tags.includes(tag));
  return [...new Set([...head, ...tags, ...added])];
}

function stringifyFrontMatter(original, value) {
  const { frontMatterText, frontMatter } = original;
  const before = parse(frontMatterText + original.body);
  const tags = (Array.isArray(frontMatter.tags) ? frontMatter.tags : []).map(String);
  const newTags = buildTags(tags, value);
  const changed =
    before.title !== (value.title ?? '') ||
    before.description !== (value.description ?? '') ||
    !sameList(tags, newTags);
  if (!changed && frontMatterText) {
    return frontMatterText;
  }

  const source = frontMatterText.match(FRONT_MATTER)?.[1] ?? '';
  const doc = source ? loadYamlDocument(source) : new Document({});
  for (const key of ['title', 'description']) {
    const newValue = value[key] ?? '';
    if (before[key] === newValue) {
      continue;
    }
    // Updating the existing scalar keeps its quoting style
    const node = doc.get(key, true);
    if (isScalar(node)) {
      node.value = newValue;
    } else {
      doc.set(key, newValue);
    }
  }
  if (!sameList(tags, newTags)) {
    doc.set('tags', doc.createNode(newTags));
  }
  // Most terms list their tags without indentation
  const indentSeq = /^tags:[ \t]*\r?\n[ \t]+-/m.test(source);
  const yaml = doc.toString({ lineWidth: 0, indentSeq }).trimEnd();
  return `---\n${yaml}\n---\n`;
}

function stringifyPrefix(prefix, before, value) {
  let result = prefix;
  if (before.title !== (value.title ?? '') && /^# .*$/m.test(result)) {
    result = result.replace(/^# .*$/m, `# ${value.title ?? ''}`);
  }
  if (!sameList(before.synonyms, value.synonyms ?? [])) {
    const synonyms = (value.synonyms ?? []).filter(Boolean);
    const line = synonyms.length > 0 ? `**Synonyms**: ${synonyms.join(', ')}` : '';
    if (SYNONYMS.test(result)) {
      result = line
        ? result.replace(SYNONYMS, line)
        : result.replace(/^\*\*Synonyms\*\*:.*\r?\n(\r?\n)?/m, '');
    } else if (line) {
      result = result.replace(/^(# .*\r?\n)(\r?\n)?/m, `$1\n${line}\n\n`);
    }
  }
  return result;
}

function stringifyBlock(number, definition) {
  const lines = [`## ${number} Definition`, '', definition.definition];
  for (const key of SECTIONS) {
    lines.push('', `### ${key[0].toUpperCase()}${key.slice(1)}`, '', definition[key]);
  }
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

/**
 * Write the form data back into the term file. Unchanged parts keep their exact text, so a save
 * only changes what was edited.
 */
export function stringify(value, originalText = '') {
  const original = splitFile(originalText);
  const before = parse(originalText);
  const { prefix, blocks } = splitBody(original.body);
  const originalDefinitions = blocks.map(parseBlock);
  const used = new Set();

  const definitions = (value.definitions ?? []).map(normalizeDefinition);
  const newBlocks = definitions.map((definition, i) => {
    const index = originalDefinitions.findIndex(
      (candidate, j) => !used.has(j) && sameDefinition(candidate, definition),
    );
    if (index === -1) {
      return stringifyBlock(i + 1, definition);
    }
    used.add(index);
    return blocks[index].replace(/^## \d+ Definition/, `## ${i + 1} Definition`);
  });

  const unchangedBody =
    newBlocks.length === blocks.length &&
    newBlocks.every((block, i) => block === blocks[i]) &&
    before.title === (value.title ?? '') &&
    sameList(before.synonyms, value.synonyms ?? []);

  const frontMatter = stringifyFrontMatter(original, value);
  if (unchangedBody) {
    return frontMatter + original.body;
  }
  const head = stringifyPrefix(prefix, before, value);
  const body = newBlocks.length > 0 ? `${head}${newBlocks.join('\n\n___\n\n')}\n` : head;
  return frontMatter + body;
}
