<template>
  <div class="json-schema-editor">
    <v-defaults-provider :defaults="defaults">
      <JsonForms
        v-if="formData"
        :data="formData"
        :schema="schema"
        :uischema="uiSchema"
        :renderers="renderers"
        @change="onChange"
        :readonly="this.readOnly"
      />
    </v-defaults-provider>
  </div>
</template>

<script>
import BaseEditorMixin from './BaseEditorMixin';
import { useNotificationsStore } from '@/stores/notifications';
import { JsonForms } from '@jsonforms/vue';
import { extendedVuetifyRenderers } from '@jsonforms/vue-vuetify';
import { markRaw } from 'vue';
import { getCodec, getEditingSchema, getUiSchema } from './utils';
import EnumChipsRenderer, { tester as enumChipsTester } from './renderers/EnumChipsRenderer.vue';
import StringArrayRenderer, {
  tester as stringArrayTester,
} from './renderers/StringArrayRenderer.vue';

// The components themselves must be imported: the production build drops the template of an unused default export
const renderers = markRaw([
  ...extendedVuetifyRenderers,
  { renderer: EnumChipsRenderer, tester: enumChipsTester },
  { renderer: StringArrayRenderer, tester: stringArrayTester },
]);

const fieldDefaults = { variant: 'outlined', density: 'compact', hideDetails: 'auto' };

export default {
  name: 'JsonSchemaEditor',
  mixins: [BaseEditorMixin],
  components: {
    JsonForms,
  },
  data() {
    return {
      renderers: Object.freeze(renderers),
      defaults: Object.freeze({
        VTextField: fieldDefaults,
        VTextarea: { ...fieldDefaults, autoGrow: true, rows: 2 },
        VSelect: fieldDefaults,
        VCombobox: fieldDefaults,
        VAutocomplete: fieldDefaults,
      }),
      formData: null,
      // The text this form wrote last; re-parsing it would reset fields while typing
      ownText: null,
    };
  },
  computed: {
    notifications() {
      return useNotificationsStore();
    },
    codec() {
      return getCodec(this.file);
    },
    schema() {
      return getEditingSchema(this.file);
    },
    uiSchema() {
      return getUiSchema(this.file);
    },
  },
  watch: {
    data: {
      immediate: true,
      handler(text) {
        if (text !== this.ownText) {
          this.formData = this.parse(text);
        }
      },
    },
  },
  methods: {
    parse(text) {
      try {
        return this.codec.parse(text);
      } catch (error) {
        this.notifications.error(
          'The file is invalid, opening in the source code editor. Please fix the issues there.',
        );
        this.$emit('error', error);
        return {};
      }
    },
    onChange(event) {
      const text = this.codec.stringify(event.data, this.data);
      this.ownText = text;
      this.data = text;
    },
  },
};
</script>

<style>
@import '@jsonforms/vue-vuetify/lib/jsonforms-vue-vuetify.css';

.json-schema-editor .vertical-layout-item + .vertical-layout-item {
  margin-top: 12px;
}
.json-schema-editor .horizontal-layout {
  gap: 12px;
}
.json-schema-editor .horizontal-layout-item {
  padding: 0;
}
.json-schema-editor .chips-control .v-chip-group {
  padding: 0;
}
.json-schema-editor .chips-control-label {
  margin-bottom: 2px;
}
/* Lists of objects, e.g. glossary definitions: a heading with an add button, then light cards */
.json-schema-editor .array-list-toolbar {
  background: transparent;
  padding: 0;
  min-height: 0;
}
.json-schema-editor .array-list-toolbar .v-toolbar__content {
  height: auto !important;
  padding: 0;
}
.json-schema-editor .array-list-title {
  font-size: 1rem;
  font-weight: 500;
}
.json-schema-editor .array-list.v-card {
  box-shadow: none;
  background: transparent;
}
.json-schema-editor .array-list > .v-card-title,
.json-schema-editor .array-list > .v-card-text {
  padding-left: 0;
  padding-right: 0;
}
.json-schema-editor .array-list .v-expansion-panel {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  box-shadow: none;
}
.json-schema-editor .array-list .v-expansion-panel::after {
  display: none;
}
.json-schema-editor .array-list-item-header {
  min-height: 44px;
  padding: 4px 12px;
}
.json-schema-editor .array-list-item-content .v-expansion-panel-text__wrapper {
  padding: 8px 12px 12px;
}
</style>

<style scoped>
.json-schema-editor {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
}
</style>

<style scoped>
.json-schema-editor {
  height: 100%;
  overflow-y: auto;
}
</style>
