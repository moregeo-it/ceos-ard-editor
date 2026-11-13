<template>
  <span class="file-path"
    ><template v-for="(segment, i) in segments" :key="i"
      ><template v-if="i"><wbr /><span class="file-path-separator">/</span></template
      ><span :class="i < segments.length - 1 ? 'file-path-folder' : 'file-path-name'">{{
        segment
      }}</span></template
    ></span
  >
</template>

<script>
import { mdiChevronRight } from '@mdi/js';
import { displayPath } from '@/utils/paths';

const CHEVRON = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${mdiChevronRight}"/></svg>`,
)}")`;

/**
 * A file path as breadcrumbs, e.g. `pfs › NRB › document.yaml`, wrapping between segments. The
 * separators are slashes drawn as chevrons, so it copies and reads as the plain path.
 */
export default {
  name: 'FilePath',

  props: {
    path: { type: String, required: true },
  },

  computed: {
    segments() {
      return displayPath(this.path).split('/').filter(Boolean);
    },
  },

  created() {
    this.chevron = CHEVRON;
  },
};
</script>

<style scoped>
/* Inline only: blocks would add line breaks to copied text and spaces to the accessible name */
.file-path {
  overflow-wrap: anywhere;
}

.file-path-folder {
  opacity: var(--v-medium-emphasis-opacity);
}

.file-path-separator {
  padding: 0 0.3em;
  -webkit-text-fill-color: transparent;
  background-color: currentColor;
  opacity: var(--v-medium-emphasis-opacity);
  mask: v-bind(chevron) center / 1.1em no-repeat;
}
</style>
