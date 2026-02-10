<template>
  <div class="json-schema-editor">
    <JsonForms
      :data="parsedData"
      :schema="schema"
      :uischema="uiSchema"
      :renderers="renderers"
      @change="onChange"
      :readonly="this.readOnly"
    />
  </div>
</template>

<script>
import BaseEditorMixin from './BaseEditorMixin';
import { useNotificationsStore } from '@/stores/notifications';
import { JsonForms } from '@jsonforms/vue';
import { extendedVuetifyRenderers } from '@jsonforms/vue-vuetify';
import { markRaw } from 'vue';
import { getEditingSchema, getUiSchema } from './utils';
import { load, dump } from '@/utils/enhanced-yaml';

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
    notifications() {
      return useNotificationsStore();
    },
    schema() {
      return getEditingSchema(this.file, this.data);
    },
    uiSchema() {
      return getUiSchema(this.file, this.data);
    },
    parsedData() {
      return this.parse();
    },
  },
  methods: {
    parse() {
      try {
        return load(this.data);
      } catch (error) {
        this.notifications.error(
          'The YAML file is invalid, opening in the source code editor. Please fix the issues there.',
        );
        this.$emit('error', error);
        return {};
      }
    },
    onChange(event) {
      this.data = dump(event.data, {}, this.data);
    },
  },
};
</script>

<style>
@import '@jsonforms/vue-vuetify/lib/jsonforms-vue-vuetify.css';
</style>
