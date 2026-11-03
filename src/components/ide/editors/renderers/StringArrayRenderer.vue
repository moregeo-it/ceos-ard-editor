<template>
  <v-combobox
    class="control"
    :model-value="control.data ?? []"
    :label="computedLabel"
    :hint="control.description"
    :error-messages="control.errors"
    :disabled="!control.enabled"
    persistent-hint
    multiple
    chips
    closable-chips
    hide-details="auto"
    @update:model-value="onChange"
  />
</template>

<script>
import { and, isControl, rankWith, schemaMatches } from '@jsonforms/core';
import { rendererProps, useJsonFormsControl } from '@jsonforms/vue';

// A list of free texts, e.g. synonyms, as chips instead of a table
const StringArrayRenderer = {
  name: 'StringArrayRenderer',
  props: {
    ...rendererProps(),
  },
  setup(props) {
    return useJsonFormsControl(props);
  },
  computed: {
    computedLabel() {
      return this.control.required ? `${this.control.label}*` : this.control.label;
    },
  },
  methods: {
    onChange(values) {
      const cleaned = [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
      this.handleChange(this.control.path, cleaned);
    },
  },
};

export default StringArrayRenderer;

// Above the extended Vuetify renderers, which use 10
export const tester = rankWith(
  15,
  and(
    isControl,
    schemaMatches(
      (schema) => schema.type === 'array' && schema.items?.type === 'string' && !schema.items.enum,
    ),
  ),
);
</script>
