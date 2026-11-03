import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchesGlob } from '../../src/utils/glob.js';

// The same cases as test_match_glob in ceos-ard-server, which matches the same globs
const cases = [
  ['/pfs', 'pfs', true],
  ['/pfs/NRB', 'pfs/*', true],
  ['/pfs/NRB/document.yaml', 'pfs/*', false],
  ['/pfs/NRB/document.yaml', 'pfs/**', true],
  ['/glossary/accuracy.yaml', 'glossary/*.yaml', true],
  ['/foo.yaml', '**/foo.yaml', true],
  ['/a/b/foo.yaml', '**/foo.yaml', true],
  ['/notfoo.yaml', '**/foo.yaml', false],
  ['/a/notfoo.yaml', '**/foo.yaml', false],
  ['/a/b/c', '**', true],
];

for (const [path, glob, matches] of cases) {
  test(`${glob} ${matches ? 'matches' : "doesn't match"} ${path}`, () => {
    assert.equal(matchesGlob(path, glob), matches);
  });
}
