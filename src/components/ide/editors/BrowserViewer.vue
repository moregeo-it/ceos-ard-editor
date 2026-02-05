<template>
  <iframe :src="blob" width="100%" height="100%" class="iframe fill-height"></iframe>
</template>

<script>
import BaseEditorMixin from './BaseEditorMixin';

export default {
  name: 'BrowserViewer',

  mixins: [BaseEditorMixin],

  computed: {
    blob() {
      if (this.value) {
        return URL.createObjectURL(this.value);
      }
      return null;
    },
  },
};
</script>

<style scoped>
.iframe {
  border: none;
}
</style>
