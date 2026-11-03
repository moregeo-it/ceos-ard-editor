<template>
  <div class="control chips-control">
    <div class="chips-control-label text-caption text-medium-emphasis">{{ computedLabel }}</div>
    <v-chip-group
      :model-value="control.data"
      :multiple="multiple"
      :mandatory="!multiple && control.required && control.data !== undefined"
      :disabled="!control.enabled"
      selected-class="text-primary"
      column
      filter
      @update:model-value="onChange"
    >
      <v-chip
        v-for="value in options"
        :key="value"
        :value="value"
        :disabled="!control.enabled"
        size="small"
        variant="outlined"
      >
        {{ value }}
      </v-chip>
    </v-chip-group>
    <div v-if="control.errors" class="text-caption text-error">{{ control.errors }}</div>
  </div>
</template>

<script>
import {
  and,
  isControl,
  isEnumControl,
  optionIs,
  or,
  rankWith,
  schemaMatches,
} from '@jsonforms/core';
import { rendererProps, useJsonFormsControl } from '@jsonforms/vue';

// Choices as chips: lists of enums always, single enums with the UI schema option "chips"
const EnumChipsRenderer = {
  name: 'EnumChipsRenderer',
  props: {
    ...rendererProps(),
  },
  setup(props) {
    return useJsonFormsControl(props);
  },
  computed: {
    multiple() {
      return this.control.schema.type === 'array';
    },
    options() {
      return (this.multiple ? this.control.schema.items : this.control.schema)?.enum ?? [];
    },
    computedLabel() {
      return this.control.required ? `${this.control.label}*` : this.control.label;
    },
  },
  methods: {
    onChange(value) {
      if (this.multiple) {
        // Keep the order of the options, not the order of clicking
        this.handleChange(
          this.control.path,
          this.options.filter((option) => (value ?? []).includes(option)),
        );
      } else {
        this.handleChange(this.control.path, value ?? undefined);
      }
    },
  },
};

export default EnumChipsRenderer;

// Above the extended Vuetify renderers, which use 10
export const tester = rankWith(
  15,
  or(
    and(
      isControl,
      schemaMatches((schema) => schema.type === 'array' && Array.isArray(schema.items?.enum)),
    ),
    and(isEnumControl, optionIs('chips', true)),
  ),
);
</script>
