import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accepts, parse, stringify } from '../../src/codecs/modspec.js';

// From opengeospatial/ogcapi-records and opengeospatial/geoparquet
const REQUIREMENT = `[[req_records-api_catalog-response]]

//[width="90%",cols="2,6a"]
//|===
//^|A |The old table
//----
//|===

[requirement]
====
[%metadata]
identifier:: /req/records-api/catalog-response
part:: The body of the response SHALL contain a description of the catalog:
+
[source,YAML]
----
include::../../../../openapi/schemas/collection.yaml[]
----

part:: The collection SHALL homogeneously reference records.
part:: The value of the \`itemType\` property SHALL be \`record\`.

====
`;

const TEST = `[abstract_test]
====
[%metadata]
identifier:: /conf/core/repetition
target:: /req/core/repetition
test-purpose:: Validate the cardinality of geometry columns.
test-method::
+
--
1. Verify that the cardinality for all geometry columns is "required" or "optional".

2. Verify that no geometry column is repeated.

--
====
`;

const RECOMMENDATION = `[[rec_stac-extensions_assets]]

[recommendation]
====
[%metadata]
identifier:: /rec/stac-extensions/assets
part:: A record that includes \`stac_extensions\` SHOULD include \`assets\`.
====

NOTE: The first part is a workaround.
`;

const CONFORMANCE_CLASS = `[[ats_stac]]

[conformance_class]
====
[%metadata]
identifier:: http://www.opengis.net/spec/ogcapi-records-5/1.0/conf/stac
target:: http://www.opengis.net/spec/ogcapi-records-5/1.0/req/stac
classification:: Target Type:Document model
inherit:: http://www.opengis.net/spec/ogcapi-records-1/1.0/conf/record-core
abstract-test:: /conf/stac/entity
abstract-test:: /conf/stac/version
====

==== STAC entities

include::stac/ATS_entity.adoc[]
`;

test('reads a requirement with an attached listing', () => {
  assert.deepEqual(parse(REQUIREMENT), {
    type: 'requirement',
    identifier: '/req/records-api/catalog-response',
    part: [
      'The body of the response SHALL contain a description of the catalog:\n+\n[source,YAML]\n----\ninclude::../../../../openapi/schemas/collection.yaml[]\n----',
      'The collection SHALL homogeneously reference records.',
      'The value of the `itemType` property SHALL be `record`.',
    ],
  });
});

test('reads the text of an attached open block', () => {
  assert.equal(
    parse(TEST)['test-method'],
    '1. Verify that the cardinality for all geometry columns is "required" or "optional".\n\n2. Verify that no geometry column is repeated.\n',
  );
});

test('unchanged forms keep the file', () => {
  for (const text of [REQUIREMENT, TEST, RECOMMENDATION, CONFORMANCE_CLASS]) {
    assert.equal(stringify(parse(text), text), text);
  }
});

test('only edited fields change', () => {
  const value = parse(REQUIREMENT);
  value.part[1] = 'The collection SHALL reference records only.';
  assert.equal(
    stringify(value, REQUIREMENT),
    REQUIREMENT.replace(
      'part:: The collection SHALL homogeneously reference records.',
      'part:: The collection SHALL reference records only.',
    ),
  );
});

test('parts can be added and removed', () => {
  const value = parse(RECOMMENDATION);
  value.part.push('A second part.');
  const added = stringify(value, RECOMMENDATION);
  assert.ok(added.includes('SHOULD include `assets`.\npart:: A second part.\n====\n\nNOTE:'));
  value.part = [];
  assert.ok(!stringify(value, RECOMMENDATION).includes('part::'));
});

test('new fields go after the fields before them', () => {
  const value = parse(RECOMMENDATION);
  value.statement = 'A statement.';
  assert.ok(
    stringify(value, RECOMMENDATION).includes(
      'identifier:: /rec/stac-extensions/assets\nstatement:: A statement.\npart::',
    ),
  );
});

test('text with several lines is written in an open block', () => {
  const value = parse(TEST);
  value['test-method'] = 'Verify one.\nVerify two.';
  assert.ok(
    stringify(value, TEST).includes('test-method::\n+\n--\nVerify one.\nVerify two.\n--\n===='),
  );
});

test('the block type stays', () => {
  const value = parse(TEST);
  value.type = 'requirement';
  assert.equal(stringify(value, TEST), TEST);
});

test('Windows line endings stay', () => {
  const text = RECOMMENDATION.replace(/\n/g, '\r\n');
  const value = parse(text);
  value.identifier = '/rec/stac-extensions/assets-2';
  const result = stringify(value, text);
  assert.ok(result.includes('identifier:: /rec/stac-extensions/assets-2\r\n'));
  assert.ok(!/[^\r]\n/.test(result));
});

test('other files are left to their usual editor', () => {
  assert.equal(accepts(CONFORMANCE_CLASS), true);
  // Requirements written as tables, e.g. in OGC API - Records - OpenSearch
  assert.equal(accepts('[[rc_opensearch]]\n[cols="1,4",width="90%"]\n|===\n|A |B\n|===\n'), false);
  assert.equal(accepts('== Scope\n\nText.\n'), false);
  assert.equal(accepts(`${RECOMMENDATION}\n${TEST}`), false);
  assert.equal(accepts(TEST.replace('target::', 'test-method:: Once.\ntarget::')), false);
});
