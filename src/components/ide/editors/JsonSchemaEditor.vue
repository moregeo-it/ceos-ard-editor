<template>
  <JsonForms
    :data="parsedData"
    :schema="schema"
    :uischema="uiSchema"
    :renderers="renderers"
    @change="onChange"
    :readonly="this.readOnly"
  />
</template>

<script>
import BaseEditorMixin from './BaseEditorMixin';
import { JsonForms } from '@jsonforms/vue';
import { extendedVuetifyRenderers } from '@jsonforms/vue-vuetify';
import { markRaw } from 'vue';
import { getEditingSchema, getUiSchema } from './utils';
import { parse, parseDocument } from 'yaml';

const renderers = markRaw([
  ...extendedVuetifyRenderers,
  // here you can add custom renderers
]);

export default {
  name: 'JsonSchemaEditor',
  mixins: [BaseEditorMixin],
  components: {
    JsonForms,
  },
  data() {
    return {
      renderers: Object.freeze(renderers),
    };
  },
  computed: {
    schema() {
      return getEditingSchema(this.file, this.data);
    },
    uiSchema() {
      return getUiSchema(this.file, this.data);
    },
    parsedData() {
      // todo: error handling?
      return parse(this.data);
    },
  },
  methods: {
    onChange(event) {
      // Parse original as a Document to preserve comments and styling,
      // then update its contents with the new data and re-stringify.
      const doc = parseDocument(this.data);
      doc.contents = doc.createNode(event.data);
      this.data = doc.toString();
    },
  },
};
</script>

<style>
@import '@jsonforms/vue-vuetify/lib/jsonforms-vue-vuetify.css';
</style>
