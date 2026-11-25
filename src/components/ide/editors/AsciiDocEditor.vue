<template>
  <div ref="container" class="asciidoc-editor" @keydown.capture="save"></div>
</template>

<script>
import BaseEditorMixin from './BaseEditorMixin';
import init, { mount } from 'asciidoc-editor';
// Explicitly, as Vite's dependency pre-bundling loses the file next to the module
import wasm from 'asciidoc-editor/asciidoc_editor_bg.wasm?url';

let loading = null;

export default {
  name: 'AsciiDocEditor',
  mixins: [BaseEditorMixin],
  data() {
    return {
      editor: null,
      destroyed: false,
    };
  },
  computed: {
    theme() {
      return this.$vuetify.theme.name === 'dark' ? 'dark' : 'light';
    },
  },
  watch: {
    value(value) {
      if (this.editor && value !== this.editor.value()) {
        this.editor.setValue(value);
      }
    },
    theme() {
      this.remount();
    },
  },
  async mounted() {
    try {
      loading ??= init({ module_or_path: wasm });
      await loading;
    } catch (error) {
      loading = null;
      this.$emit('error', error);
      return;
    }
    if (!this.destroyed) {
      this.remount();
    }
  },
  beforeUnmount() {
    this.destroyed = true;
    this.editor?.destroy();
    this.editor = null;
  },
  methods: {
    remount() {
      this.editor?.destroy();
      this.editor = mount(this.$refs.container, {
        value: this.data,
        theme: this.theme,
        toolbar: { hide: ['brand', 'file', 'image'] },
        onFile: () => {
          throw new Error('Add images to the workspace in the file tree, then refer to them.');
        },
      });
      this.editor.onChange((source) => {
        this.data = source;
      });
    },
    save(event) {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        if (!this.readOnly) {
          this.$emit('save');
        }
      }
    },
  },
};
</script>

<style scoped>
.asciidoc-editor {
  height: 100%;
  width: 100%;
}
</style>
