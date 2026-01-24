<template>
  <div class="text-center pa-4">
    <p class="text-subtle">The Editor doesn't support showing this file type.</p>
  </div>
</template>

<script>
import BaseEditorMixin from './BaseEditorMixin';

export default {
  name: 'UnsupportedViewer',
  mixins: [BaseEditorMixin],
};
</script>
