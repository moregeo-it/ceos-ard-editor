<template>
  <div v-if="control.visible" class="text-list-control">
    <div class="text-body-2 text-medium-emphasis mb-2">{{ computedLabel }}</div>
    <div v-for="(item, index) in items" :key="index" class="d-flex align-start ga-1 mb-2">
      <v-textarea
        :model-value="item"
        :label="`${control.label} ${index + 1}`"
        :disabled="!control.enabled"
        rows="1"
        auto-grow
        hide-details="auto"
        variant="outlined"
        density="compact"
        @update:model-value="(value) => update(index, value)"
      />
      <v-btn
        icon="$itemDelete"
        variant="text"
        size="small"
        :disabled="!control.enabled"
        :aria-label="`Remove ${control.label} ${index + 1}`"
        @click="remove(index)"
      />
    </div>
    <v-btn
      prepend-icon="$itemAdd"
      variant="tonal"
      size="small"
      :disabled="!control.enabled"
      @click="add"
      >Add</v-btn
    >
    <div v-if="control.description" class="text-caption text-medium-emphasis mt-1">
      {{ control.description }}
    </div>
  </div>
</template>

<script>
import { and, isControl, optionIs, rankWith, schemaMatches } from '@jsonforms/core';
import { rendererProps, useJsonFormsControl } from '@jsonforms/vue';

// A list of longer texts, e.g. the parts of a requirement, one text field each
const TextListRenderer = {
  name: 'TextListRenderer',
  props: {
    ...rendererProps(),
  },
  setup(props) {
    return useJsonFormsControl(props);
  },
  computed: {
    items() {
      return this.control.data ?? [];
    },
    computedLabel() {
      return this.control.required ? `${this.control.label}*` : this.control.label;
    },
  },
  methods: {
    update(index, value) {
      const items = [...this.items];
      items[index] = value;
      this.handleChange(this.control.path, items);
    },
    remove(index) {
      this.handleChange(
        this.control.path,
        this.items.filter((_, i) => i !== index),
      );
    },
    add() {
      this.handleChange(this.control.path, [...this.items, '']);
    },
  },
};

export default TextListRenderer;

// Above the chips of StringArrayRenderer, for lists with the `multi` option
export const tester = rankWith(
  20,
  and(
    isControl,
    optionIs('multi', true),
    schemaMatches(
      (schema) => schema.type === 'array' && schema.items?.type === 'string' && !schema.items.enum,
    ),
  ),
);
</script>
