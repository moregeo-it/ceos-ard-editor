<template>
  <div class="fill-height overflow-auto">
    <img :src="blob" alt="Image Preview" />
  </div>
</template>

<script>
import BaseEditorMixin from './BaseEditorMixin';

export default {
  name: 'ImageViewer',

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
