<template>
  <v-dialog v-model="show" :max-width="sizes.medium">
    <v-form @submit.prevent="submit">
      <v-card>
        <v-card-title>{{ action.title }}</v-card-title>
        <v-card-text>
          <JsonForms
            :data="formData"
            :schema="action.schema"
            :uischema="action.ui_schema"
            :renderers="renderers"
            @change="onChange"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="reject">Cancel</v-btn>
          <v-btn
            color="primary"
            type="submit"
            :disabled="!isValid"
            :loading="accepting"
            variant="elevated"
            >Create</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-form>
  </v-dialog>
</template>

<script>
import { markRaw } from 'vue';
import { JsonForms } from '@jsonforms/vue';
import { extendedVuetifyRenderers } from '@jsonforms/vue-vuetify';
import DialogMixin from '@/components/DialogMixin';

const renderers = markRaw([...extendedVuetifyRenderers]);

export default {
  name: 'ActionDialog',
  components: {
    JsonForms,
  },
  mixins: [DialogMixin],
  props: {
    // An action of the workspace type: { id, title, schema, ui_schema? }
    action: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      renderers: Object.freeze(renderers),
      formData: {},
      errors: [],
    };
  },
  computed: {
    isValid() {
      return this.errors.length === 0;
    },
  },
  methods: {
    onChange(event) {
      this.formData = event.data;
      this.errors = event.errors ?? [];
    },
    submit() {
      if (this.isValid) {
        this.accept(this.formData);
      }
    },
  },
};
</script>

<style>
@import '@jsonforms/vue-vuetify/lib/jsonforms-vue-vuetify.css';
</style>
