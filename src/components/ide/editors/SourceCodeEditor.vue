<template>
  <!--
    Collaborative variant: content is driven by @codemirror/collab (operational transformation)
    against the server authority. The doc is created ONCE with the authority's base document
    (`collabInitialDoc`, a constant) and no `v-model`, so vue-codemirror6's replace-watcher stays
    dormant; a ViewPlugin then replays the update backlog and keeps pushing/receiving edits.
  -->
  <CodeMirror
    v-if="collab"
    class="code-editor"
    :model-value="collabInitialDoc"
    :extensions="collabExtensions"
    :basic="true"
    :wrap="true"
    :readonly="readOnly"
    :dark="isDark"
    :tab-size="2"
  />
  <!-- Non-collaborative variant: unchanged v-model editor for private/unshared files. -->
  <CodeMirror v-else class="code-editor" v-model="data" v-bind="settings" />
</template>

<script>
import BaseEditorMixin from './BaseEditorMixin';
import CodeMirror from 'vue-codemirror6';
import { markRaw } from 'vue';
import { keymap, ViewPlugin } from '@codemirror/view';
import { ChangeSet, Transaction } from '@codemirror/state';
import { collab, getSyncedVersion, receiveUpdates, sendableUpdates } from '@codemirror/collab';
import { defaultKeymap, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { linter, lintGutter } from '@codemirror/lint';
import { markdown } from '@codemirror/lang-markdown';
import { yaml } from '@codemirror/lang-yaml';
import { bibtex } from '@citedrive/codemirror-lang-bibtex';
import { hyperLink } from '@uiw/codemirror-extensions-hyper-link';

const MAX_DIAGNOSTICS = 100;

// The authority stores updates as opaque JSON; convert to/from CodeMirror's collab Update shape.
function serializeUpdates(updates) {
  return updates.map((u) => ({ clientID: u.clientID, changes: u.changes.toJSON() }));
}
function deserializeUpdates(updates) {
  return updates.map((u) => ({ clientID: u.clientID, changes: ChangeSet.fromJSON(u.changes) }));
}

export default {
  name: 'SourceCodeEditor',
  mixins: [BaseEditorMixin],
  components: {
    CodeMirror,
  },
  emits: ['collab-edit'],
  props: {
    // Live collaboration session for this file (from collab.service), if collaboration is active.
    collab: {
      type: Object,
      default: null,
    },
  },
  data() {
    return {
      // The authority's base document, captured once (constant) so the wrapper's modelValue
      // watcher never fires; the ViewPlugin replays updates on top of it.
      collabInitialDoc: '',
      // Built once (markRaw) so CodeMirror never re-proxies/re-attaches the collab extensions.
      collabExtensions: null,
    };
  },
  created() {
    if (this.collab) {
      this.collabInitialDoc = this.collab.initialDoc ?? '';
      this.collabExtensions = markRaw(this.buildCollabExtensions());
    }
  },
  computed: {
    isDark() {
      return this.$vuetify.theme.name === 'dark';
    },
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
      const extensions = [
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, this.saveKeymap]),
        highlightSelectionMatches(),
        hyperLink,
        lintGutter(),
        this.buildLintExtension(),
      ];
      if (this.languageExtension) {
        extensions.push(this.languageExtension);
      }
      return {
        basic: true,
        wrap: true,
        readonly: this.readOnly,
        dark: this.isDark,
        tabSize: 2,
        extensions,
      };
    },
  },
  methods: {
    buildLintExtension() {
      return linter((view) => {
        if (!this.languageExtension) {
          return [];
        }
        return this.parseDiagnostics(this.languageExtension, view);
      });
    },
    buildCollabExtensions() {
      const extensions = [
        collab({ startVersion: 0, clientID: this.collab.clientID }),
        this.buildCollabSyncPlugin(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, this.saveKeymap]),
        highlightSelectionMatches(),
        hyperLink,
        lintGutter(),
        this.buildLintExtension(),
      ];
      if (this.languageExtension) {
        extensions.push(this.languageExtension);
      }
      return extensions;
    },
    buildCollabSyncPlugin() {
      const session = this.collab;
      const emitLocalEdit = () => this.$emit('collab-edit');
      return ViewPlugin.fromClass(
        class {
          constructor(view) {
            this.view = view;
            this._pushedAtVersion = -1;
            session.setView(view);
            // Replay the authority's backlog so the editor reaches the current version.
            if (session.initialUpdates && session.initialUpdates.length) {
              view.dispatch(receiveUpdates(view.state, deserializeUpdates(session.initialUpdates)));
            }
            session.onUpdates((updates) => {
              this.view.dispatch(receiveUpdates(this.view.state, deserializeUpdates(updates)));
              this.push();
            });
            this.push();
          }
          update(viewUpdate) {
            if (!viewUpdate.docChanged) {
              return;
            }
            // Remote edits (applied via receiveUpdates) carry no userEvent; only a local user
            // edit flips the dirty indicator / triggers autosave.
            const isLocal = viewUpdate.transactions.some(
              (tr) => tr.annotation(Transaction.userEvent) !== undefined,
            );
            if (isLocal) {
              emitLocalEdit();
            }
            this.push();
          }
          push() {
            const version = getSyncedVersion(this.view.state);
            const updates = sendableUpdates(this.view.state);
            // Only push once per version: our updates are confirmed when the authority broadcasts
            // them back (advancing the synced version), which re-runs push() for anything pending.
            if (!updates.length || this._pushedAtVersion === version) {
              return;
            }
            this._pushedAtVersion = version;
            session.push(version, serializeUpdates(updates));
          }
        },
      );
    },
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
