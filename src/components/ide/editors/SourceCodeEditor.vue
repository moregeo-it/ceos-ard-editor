<template>
  <CodeMirror class="code-editor" v-model="data" v-bind="settings" />
</template>

<script>
import BaseEditorMixin from './BaseEditorMixin';
import CodeMirror from 'vue-codemirror6';
import { keymap } from '@codemirror/view';
import { defaultKeymap, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { linter, lintGutter } from '@codemirror/lint';
import { markdown } from '@codemirror/lang-markdown';
import { yaml } from '@codemirror/lang-yaml';
import { bibtex } from '@citedrive/codemirror-lang-bibtex';
import { hyperLink } from '@uiw/codemirror-extensions-hyper-link';

const MAX_DIAGNOSTICS = 100;

export default {
  name: 'SourceCodeEditor',
  mixins: [BaseEditorMixin],
  components: {
    CodeMirror,
  },
  computed: {
    fileExtension() {
      const path = this.file?.name ?? '';
      const filename = path.split('/').pop() ?? '';
      const parts = filename.split('.');
      if (parts.length < 2) {
        return '';
      }
      return parts.pop().toLowerCase();
    },
    languageExtension() {
      switch (this.fileExtension) {
        case 'md':
        case 'markdown':
          return markdown();
        case 'yml':
        case 'yaml':
          return yaml();
        case 'bib':
        case 'bibtex':
          return bibtex();
        default:
          return null;
      }
    },
    saveKeymap() {
      return {
        key: 'Mod-s',
        preventDefault: true,
        run: () => {
          if (!this.readOnly) {
            this.$emit('save');
          }
          return true;
        },
      };
    },
    settings() {
      const lintExtension = linter((view) => {
        if (!this.languageExtension) {
          return [];
        }
        return this.parseDiagnostics(this.languageExtension, view);
      });

      const extensions = [
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, this.saveKeymap]),
        highlightSelectionMatches(),
        hyperLink,
        lintGutter(),
        lintExtension,
      ];
      if (this.languageExtension) {
        extensions.push(this.languageExtension);
      }
      const settings = {
        basic: true,
        wrap: true,
        readonly: this.readOnly,
        dark: this.$vuetify.theme.name === 'dark',
        tabSize: 2,
        extensions,
      };
      return settings;
    },
  },
  methods: {
    parseDiagnostics(languageSupport, view, { message = 'Syntax error' } = {}) {
      const parser = languageSupport?.language?.parser;
      if (!parser) {
        return [];
      }
      const tree = parser.parse(view.state.doc.toString());
      const cursor = tree.cursor();
      const diagnostics = [];
      do {
        if (cursor.type?.isError) {
          const from = cursor.from;
          const to = Math.max(from + 1, cursor.to);
          diagnostics.push({
            from,
            to,
            severity: 'error',
            message,
          });
          if (diagnostics.length >= MAX_DIAGNOSTICS) {
            break;
          }
        }
      } while (cursor.next());
      return diagnostics;
    },
  },
};
</script>

<style scoped>
:deep(.cm-editor) {
  height: 100%;
}
</style>
