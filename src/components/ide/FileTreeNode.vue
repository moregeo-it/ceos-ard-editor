<template>
  <div
    class="file-tree-node"
    :class="{
      'file-tree-node--child': depth > 0,
      'file-tree-node--last': isLast,
      'file-tree-node--folder': item.type === 'folder',
    }"
    :style="depth > 0 ? { '--connector-left': (depth - 1) * 1.5 + 1.25 + 'rem' } : undefined"
  >
    <div
      class="file-tree-row d-flex align-center"
      :class="{
        'file-tree-row--active': isActivated,
        'file-tree-row--folder': item.type === 'folder',
      }"
      :style="{ paddingLeft: depth * 1.5 + 0.25 + 'rem' }"
      role="button"
      tabindex="0"
      @click="handleClick"
      @keydown.enter.prevent="handleClick"
      @keydown.space.prevent="handleClick"
    >
      <!-- Toggle button (folders only) -->
      <div class="file-tree-toggle" v-if="item.type === 'folder'">
        <v-btn
          density="compact"
          :icon="isLoading ? undefined : toggleIcon"
          :loading="isLoading"
          variant="text"
          size="small"
          tabindex="-1"
          @click.stop="handleToggle"
        >
          <template v-slot:loader>
            <v-progress-circular indeterminate="disable-shrink" size="16" width="2" />
          </template>
        </v-btn>
      </div>
      <div v-else class="file-tree-toggle-spacer" />

      <!-- Prepend icon -->
      <v-icon :icon="icon" size="small" :color="iconColor" class="mr-2" />

      <!-- Title area -->
      <div class="file-tree-title flex-grow-1 overflow-hidden">
        <div class="d-flex align-center justify-space-between">
          <span class="file-tree-name">{{ item.name }}</span>
          <FileStatusBadge v-if="item.status" :status="item.status" class="ml-2" />
        </div>
        <div v-if="item.excerpt" class="text-caption text-pre-wrap text-subtle">
          {{ item.excerpt }}
        </div>
      </div>

      <!-- Append (context menu) -->
      <div class="file-tree-append ml-1">
        <slot name="append" :item="item" />
      </div>
    </div>

    <!-- Children (recursive) -->
    <div v-if="item.type === 'folder' && isOpen" class="file-tree-children">
      <FileTreeNode
        v-for="(child, index) in item.children"
        :key="child.path"
        :item="child"
        :depth="depth + 1"
        :is-last="index === item.children.length - 1"
        :opened-set="openedSet"
        :activated-path="activatedPath"
        :loading-paths="loadingPaths"
        @toggle="$emit('toggle', $event)"
        @activate="$emit('activate', $event)"
      >
        <template #append="slotProps">
          <slot name="append" v-bind="slotProps" />
        </template>
      </FileTreeNode>
    </div>
  </div>
</template>

<script>
import {
  mdiFileDocumentOutline,
  mdiFolderOutline,
  mdiFolderOpenOutline,
  mdiChevronDown,
  mdiChevronRight,
} from '@mdi/js';
import FileStatusBadge from '../FileStatusBadge.vue';

export default {
  name: 'FileTreeNode',

  components: {
    FileStatusBadge,
  },

  props: {
    item: { type: Object, required: true },
    depth: { type: Number, default: 0 },
    isLast: { type: Boolean, default: false },
    openedSet: { type: Set, required: true },
    activatedPath: { type: String, default: null },
    loadingPaths: { type: Array, default: () => [] },
  },

  emits: ['toggle', 'activate'],

  computed: {
    isOpen() {
      return this.openedSet.has(this.item.path);
    },
    isActivated() {
      return this.activatedPath === this.item.path;
    },
    isLoading() {
      return this.loadingPaths.includes(this.item.path);
    },
    toggleIcon() {
      return this.isOpen ? mdiChevronDown : mdiChevronRight;
    },
    icon() {
      if (this.item.type === 'folder') {
        return this.isOpen ? mdiFolderOpenOutline : mdiFolderOutline;
      }
      return mdiFileDocumentOutline;
    },
    iconColor() {
      if (this.item.status === 'added') return 'green';
      if (this.item.status === 'modified') return 'warning';
      if (this.item.status === 'renamed') return 'blue';
      if (this.item.status === 'deleted') return 'red';
      return undefined;
    },
  },

  methods: {
    handleClick() {
      if (this.item.type === 'folder') {
        this.$emit('toggle', this.item);
      } else {
        this.$emit('activate', this.item.path);
      }
    },
    handleToggle() {
      this.$emit('toggle', this.item);
    },
  },
};
</script>

<style scoped>
.file-tree-row {
  position: relative;
  cursor: pointer;
  padding: 0.2rem 0.5rem 0.2rem 0;
  min-height: 2rem;
  user-select: none;
}

.file-tree-row:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.file-tree-row--active {
  background-color: rgba(var(--v-theme-primary), 0.12) !important;
}

.file-tree-node--child {
  position: relative;
}

/* Vertical line spanning full node height for non-last children */
.file-tree-node--child:not(.file-tree-node--last)::before {
  content: '';
  position: absolute;
  left: var(--connector-left);
  top: 0;
  bottom: 0;
  border-left: 1px solid rgba(var(--v-theme-on-surface), 0.3);
}

/* Horizontal branch at row center for non-last children */
.file-tree-node--child:not(.file-tree-node--last)::after {
  content: '';
  position: absolute;
  left: var(--connector-left);
  top: 1.25rem;
  width: 2.25rem;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.3);
}

.file-tree-node--child.file-tree-node--folder:not(.file-tree-node--last)::after {
  width: 0.5rem;
}

/* L-shaped connector with rounded corner for last child */
.file-tree-node--last::before {
  content: '';
  position: absolute;
  left: var(--connector-left);
  top: 0;
  height: 1.25rem;
  width: 2.25rem;
  border-left: 1px solid rgba(var(--v-theme-on-surface), 0.3);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.3);
  border-bottom-left-radius: 0.375rem;
}

.file-tree-node--last.file-tree-node--folder::before {
  width: 0.5rem;
}

.file-tree-children {
  position: relative;
}

.file-tree-toggle {
  width: 2rem;
  min-width: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-tree-toggle-spacer {
  width: 2rem;
  min-width: 2rem;
}

.file-tree-name {
  flex-grow: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 1rem;
}

.file-tree-title {
  min-width: 0;
}

.file-tree-append {
  flex-shrink: 0;
}
</style>
