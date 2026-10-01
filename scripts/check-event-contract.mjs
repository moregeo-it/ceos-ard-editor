#!/usr/bin/env node
/**
 * Guard against drift between the editor's event constants (src/services/events.js) and the
 * server's realtime event contract (WorkspaceEventType in ceos-ard-server's openapi.yaml).
 *
 * The spec is read from, in order: the SERVER_SPEC_URL env var (URL or file path), a sibling
 * ceos-ard-server checkout, or the raw GitHub URL of the server repo's main branch.
 *
 * Client-only events (the `realtime.*` namespace) are excluded from the comparison by convention.
 * The server-side counterpart is ceos-ard-server/scripts/check_event_contract.py.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW_SPEC_URL =
  'https://raw.githubusercontent.com/moregeo-it/ceos-ard-server/main/openapi.yaml';

async function loadSpec() {
  const override = process.env.SERVER_SPEC_URL;
  if (override && !/^https?:/.test(override)) {
    return { text: await readFile(override, 'utf8'), source: override };
  }
  if (!override) {
    const sibling = join(ROOT, '..', 'ceos-ard-server', 'openapi.yaml');
    if (existsSync(sibling)) {
      return { text: await readFile(sibling, 'utf8'), source: sibling };
    }
  }
  const url = override || RAW_SPEC_URL;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return { text: await response.text(), source: url };
}

function extractEventTypes(yamlText) {
  const spec = parse(yamlText);
  const values = spec?.components?.schemas?.WorkspaceEventType?.enum;
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('WorkspaceEventType enum not found in the spec');
  }
  return new Set(values);
}

const { EVENTS } = await import(new URL('../src/services/events.js', import.meta.url));
const clientServerEvents = new Set(
  Object.values(EVENTS).filter((type) => !type.startsWith('realtime.')),
);

const { text, source } = await loadSpec();
const specEvents = extractEventTypes(text);

const missingInClient = [...specEvents].filter((type) => !clientServerEvents.has(type));
const missingInSpec = [...clientServerEvents].filter((type) => !specEvents.has(type));

if (missingInClient.length || missingInSpec.length) {
  console.error(`Event contract drift against ${source}:`);
  for (const type of missingInClient) {
    console.error(`  - '${type}' is in the server spec but missing from src/services/events.js`);
  }
  for (const type of missingInSpec) {
    console.error(`  - '${type}' is in src/services/events.js but not in the server spec`);
  }
  process.exit(1);
}
console.log(`Event contract OK (${specEvents.size} server event types, spec: ${source}).`);
