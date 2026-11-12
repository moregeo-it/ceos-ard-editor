<template>
  <span class="file-path"
    ><template v-for="(segment, i) in segments" :key="i"
      ><wbr v-if="i" />{{ segment }}</template
    ></span
  >
</template>

<script>
/** A file path that wraps after its slashes, not inside names. */
export default {
  name: 'FilePath',

  props: {
    path: { type: String, required: true },
  },

  computed: {
    segments() {
      return this.path.split(/(?<=\/)/);
    },
  },
};
</script>

<style scoped>
.file-path {
  overflow-wrap: break-word;
  min-width: 0;
}
</style>
