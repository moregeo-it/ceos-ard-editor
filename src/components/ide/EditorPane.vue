<template>
  <v-container fluid class="pa-4">
    <slot name="message"></slot>
    Editor Component
  </v-container>
</template>

<script>
export default {
  name: 'EditorPane',
  computed: {
    isArchived() {
      // todo
      return this.workspace?.status === 'archived';
    },
  },
};
</script>
