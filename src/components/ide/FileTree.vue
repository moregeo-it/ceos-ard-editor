<template>
  <div ref="container" class="file-tree overflow-y-auto fill-height">
    <FileTreeNode
      v-for="(item, index) in items"
      :key="item.path"
      :item="item"
      :depth="0"
      :is-last="index === items.length - 1"
      :opened-set="openedSet"
      :activated-path="activatedPathInternal"
      :loading-paths="loadingPaths"
      @toggle="handleToggle"
      @activate="handleActivate"
    >
      <template #append="slotProps">
        <slot name="append" v-bind="slotProps" />
      </template>
    </FileTreeNode>
  </div>
</template>

<script>
import FileTreeNode from './FileTreeNode.vue';

export default {
  name: 'FileTree',

  components: {
    FileTreeNode,
  },

  props: {
    items: { type: Array, default: () => [] },
    opened: { type: Array, default: () => [] },
    activated: { type: Array, default: () => [] },
    loadingPaths: { type: Array, default: () => [] },
  },

  emits: ['update:opened', 'update:activated', 'folder-expand'],

  computed: {
    openedSet() {
      return new Set(this.opened);
    },
    activatedPathInternal() {
      return this.activated.length > 0 ? this.activated[0] : null;
    },
  },

  methods: {
    handleToggle(item) {
      const isOpen = this.openedSet.has(item.path);
      let newOpened;
      if (isOpen) {
        newOpened = this.opened.filter((p) => p !== item.path);
      } else {
        newOpened = [...this.opened, item.path];
        this.$emit('folder-expand', item);
      }
      this.$emit('update:opened', newOpened);
    },

    handleActivate(path) {
      this.$emit('update:activated', [path]);
    },

    scrollToActivated() {
      const el = this.$refs.container;
      if (!el) return;
      const active = el.querySelector('.file-tree-row--active');
      if (active) {
        active.scrollIntoView({ behavior: 'smooth' });
      }
    },
  },
};
</script>

<style scoped>
.file-tree {
  padding: 0.25rem 0;
}
</style>
