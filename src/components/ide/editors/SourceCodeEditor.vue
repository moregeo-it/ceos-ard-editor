<template>
  <Codemirror
    :modelValue="modelValue"
    @update:modelValue="$emit('update:modelValue', $event)"
    :style="{ height: '100%' }"
    autofocus
  />
</template>

<script>
import { Codemirror } from 'vue-codemirror';

export default {
  name: 'SourceCodeEditor',
  components: {
    Codemirror,
  },
  props: {
    modelValue: {
      type: String,
      default: '',
    },
    file: {
      type: Object,
      required: true,
    },
    readOnly: {
      type: Boolean,
      default: false,
    },
  },
};
</script>
