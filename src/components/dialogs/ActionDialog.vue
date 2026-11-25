<template>
  <v-dialog v-model="show" :max-width="sizes.medium" :persistent="accepting">
    <v-form @submit.prevent="submit">
      <v-card>
        <v-card-title>{{ action.title }}</v-card-title>
        <v-card-text>
          <div v-if="!form && !loadError" class="text-center pa-4">
            <v-progress-circular indeterminate color="primary" />
          </div>
          <v-alert v-else-if="loadError" type="error" variant="tonal" density="compact">
            {{ loadError }}
          </v-alert>
          <JsonForms
            v-else
            :data="formData"
            :schema="form.schema"
            :uischema="form.ui_schema ?? undefined"
            :renderers="renderers"
            @change="onChange"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="reject" :disabled="accepting">Cancel</v-btn>
          <v-btn
            color="primary"
            type="submit"
            :disabled="!form || !isValid || accepting"
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
import fileService from '@/services/file.service';
import { useWorkspacesStore } from '@/stores/workspaces';

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
      // From the server, which may add options of the workspace to the action's schema
      form: null,
      loadError: null,
      formData: {},
      errors: [],
    };
  },
  computed: {
    isValid() {
      return this.errors.length === 0;
    },
  },
  async created() {
    try {
      const workspaceId = useWorkspacesStore().currentWorkspace?.id;
      this.form = Object.freeze(await fileService.fetchActionForm(workspaceId, this.action.id));
    } catch (error) {
      this.loadError = `The form couldn't be loaded: ${error.message}`;
    }
  },
  methods: {
    onChange(event) {
      this.formData = event.data;
      this.errors = event.errors ?? [];
    },
    submit() {
      if (this.form && this.isValid && !this.accepting) {
        this.accept(this.formData);
      }
    },
  },
};
</script>

<style>
@import '@jsonforms/vue-vuetify/lib/jsonforms-vue-vuetify.css';
</style>
