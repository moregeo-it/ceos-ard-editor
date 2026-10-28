<template>
  <iframe v-if="isPdf" :src="url" width="100%" height="100%" class="iframe fill-height"></iframe>
  <div v-else class="d-flex align-center justify-center fill-height overflow-auto">
    <img v-if="url" :src="url" :alt="file.name" class="image" />
  </div>
</template>

<script>
import BaseEditorMixin from './BaseEditorMixin';

export default {
  name: 'BrowserViewer',

  mixins: [BaseEditorMixin],

  data() {
    return {
      url: null,
    };
  },

  computed: {
    isPdf() {
      return this.value?.type === 'application/pdf';
    },
  },

  watch: {
    value: {
      immediate: true,
      // A blob: URL loads as the editor page, also when opened in its own tab, so an SVG's
      // scripts would run there. Images get a data: URL, which has no origin, in an <img>.
      handler(value) {
        this.revoke();
        this.url = null;
        if (!(value instanceof Blob)) {
          return;
        }
        if (this.isPdf) {
          this.url = URL.createObjectURL(value);
        } else {
          const reader = new FileReader();
          reader.onload = () => {
            if (this.value === value) {
              this.url = reader.result;
            }
          };
          reader.readAsDataURL(value);
        }
      },
    },
  },

  beforeUnmount() {
    this.revoke();
  },

  methods: {
    revoke() {
      if (this.url?.startsWith('blob:')) {
        URL.revokeObjectURL(this.url);
      }
    },
  },
};
</script>

<style scoped>
.iframe {
  border: none;
}
.image {
  max-width: 100%;
  max-height: 100%;
}
</style>
