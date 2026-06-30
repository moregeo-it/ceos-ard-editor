<template>
  <v-select
    :model-value="modelValue"
    :items="items"
    :label="label"
    :multiple="multiple"
    :chips="chips"
    :clearable="clearable"
    :loading="loading"
    :hint="hint"
    :persistent-hint="persistentHint"
    :prepend-inner-icon="icon"
    item-title="title"
    item-value="id"
    variant="outlined"
    density="compact"
    @update:model-value="handleModelUpdate"
    @update:focused="$emit('update:focused', $event)"
  >
    <template v-slot:item="{ props: itemProps, item }">
      <v-list-item v-bind="itemProps" :title="null">
        <v-list-item-title>
          <template v-if="item.props.title">
            {{ item.props.value }}: {{ item.props.title }}
          </template>
          <template v-else>
            {{ item.props.value }}
          </template>
        </v-list-item-title>
      </v-list-item>
    </template>
    <template v-if="chips" v-slot:chip="{ item, props }">
      <v-chip v-bind="props" size="small">
        {{ item.props.value }}
      </v-chip>
    </template>
  </v-select>
</template>

<script>
import { mdiFileDocumentOutline } from '@mdi/js';

export default {
  name: 'PfsSelect',
  props: {
    modelValue: {
      type: [String, Array],
      default: null,
    },
    items: {
      type: Array,
      default: () => [],
    },
    label: {
      type: String,
      required: true,
    },
    multiple: {
      type: Boolean,
      default: false,
    },
    chips: {
      type: Boolean,
      default: false,
    },
    clearable: {
      type: Boolean,
      default: false,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    hint: {
      type: String,
      default: '',
    },
    persistentHint: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      icon: mdiFileDocumentOutline,
    };
  },
  emits: ['update:modelValue', 'update:focused'],
  methods: {
    formatItemDisplay(item) {
      if (!item) return '';
      const { id, title } = item;
      return title ? `${id}: ${title}` : id;
    },
    handleModelUpdate(value) {
      // Deduplicate if array of strings
      let result = value;
      if (Array.isArray(value)) {
        result = [...new Set(value)];
      }
      this.$emit('update:modelValue', result);
    },
  },
};
</script>
