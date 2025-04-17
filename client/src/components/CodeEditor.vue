<template>
  <div class="code-editor-container">
    <div class="editor-header">
      <div class="file-info">
        <h3 class="file-name">{{ filename || 'Untitled' }}</h3>
        <button @click="saveFile" class="save-button">Save</button>
      </div>
    </div>
    <div ref="editorContainer" class="editor-container"></div>
  </div>
</template>

<script>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { yaml } from '@codemirror/lang-yaml';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';

export default {
  name: 'CodeEditor',
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    filename: {
      type: String,
      default: ''
    }
  },
  emits: ['update:modelValue', 'save'],
  setup(props, { emit }) {
    const editorContainer = ref(null);
    let view = null;
    
    // Language compartment for dynamic language switching
    const languageConf = new Compartment();
    
    // Determine language from filename
    const getLanguage = () => {
      if (!props.filename) return null;
      
      const extension = props.filename.split('.').pop().toLowerCase();
      
      switch (extension) {
        case 'md':
          return markdown();
        case 'yaml':
        case 'yml':
          return yaml();
        default:
          return null; // Default to plain text
      }
    };

    // Get filename display name
    const getDisplayFilename = () => {
      return props.filename?.split('/').pop() || 'Untitled';
    };
    
    // Save file function for the save button
    const saveFile = () => {
      emit('save');
    };

    // Handle Ctrl+S save command
    const saveCommand = {
      key: 'Ctrl-s',
      mac: 'Cmd-s',
      run: () => {
        saveFile();
        return true;
      },
      preventDefault: true
    };
    
    // Initialize CodeMirror editor
    const initEditor = () => {
      if (!editorContainer.value) return;
      
      // Dispose existing editor if it exists
      if (view) {
        view.destroy();
      }
      
      try {
        // Choose language based on file extension
        const language = getLanguage();
        
        // Editor extensions
        const extensions = [
          lineNumbers(),
          highlightActiveLine(),
          history(),
          keymap.of([
            indentWithTab,
            saveCommand,
            ...defaultKeymap,
            ...historyKeymap
          ]),
          EditorView.updateListener.of(update => {
            if (update.docChanged) {
              emit('update:modelValue', update.state.doc.toString());
            }
          }),
          languageConf.of(language || []),
          syntaxHighlighting(defaultHighlightStyle),
          EditorView.lineWrapping,
          EditorState.tabSize.of(2)
        ];

        // Create editor state
        const state = EditorState.create({
          doc: props.modelValue,
          extensions
        });
        
        // Create editor view
        view = new EditorView({
          state,
          parent: editorContainer.value
        });
        
        // Focus editor
        nextTick(() => {
          view?.focus();
        });
      } catch (err) {
        console.error('Error initializing CodeMirror editor:', err);
      }
    };
    
    // Handle editor updates when props change
    watch(() => props.modelValue, (newVal, oldVal) => {
      if (view && newVal !== oldVal && newVal !== view.state.doc.toString()) {
        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: newVal
          }
        });
      }
    });
    
    // Update editor language when filename changes and reinitialize editor
    watch(() => props.filename, () => {
      nextTick(() => {
        // If editor already exists, just update the language
        if (view) {
          const language = getLanguage();
          view.dispatch({
            effects: languageConf.reconfigure(language || [])
          });
        } else {
          // Otherwise reinitialize the editor
          initEditor();
        }
      });
    });
    
    // Set up editor on mount
    onMounted(() => {
      // Initialize editor after the DOM is ready
      nextTick(() => {
        initEditor();
      });
    });
    
    // Clean up on unmount
    onBeforeUnmount(() => {
      if (view) {
        view.destroy();
        view = null;
      }
    });
    
    return {
      editorContainer,
      saveFile,
      getDisplayFilename
    };
  }
};
</script>

<style scoped>
.code-editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden; /* Prevent double scrollbars */
}

.editor-header {
  flex: 0 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background-color: #f5f5f5;
  border-bottom: 1px solid #ddd;
}

.file-info {
  display: flex;
  align-items: center;
  width: 100%;
  justify-content: space-between;
}

.file-name {
  margin: 0;
  font-size: 1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.editor-container {
  flex: 1;
  width: 100%;
  overflow: auto; /* This container will scroll */
}

.save-button {
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 0.9rem;
  margin-left: 1rem;
}

.save-button:hover {
  background-color: #0069d9;
}

/* CodeMirror specific styles */
:deep(.cm-editor) {
  height: 100%;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
}

:deep(.cm-content) {
  padding: 4px 0;
}

:deep(.cm-gutters) {
  border-right: 1px solid #ddd;
  background-color: #f8f8f8;
}

:deep(.cm-activeLineGutter) {
  background-color: #e8f2ff;
}

:deep(.cm-line) {
  padding: 0 4px 0 6px;
}

:deep(.cm-diagnostic-error) {
  text-decoration: underline wavy #d73a49;
}

:deep(.cm-diagnostic-warning) {
  text-decoration: underline wavy #e36209;
}

:deep(.cm-matchingBracket) {
  background-color: rgba(0, 120, 212, 0.2);
}

:deep(.cm-selectionMatch) {
  background-color: rgba(0, 120, 212, 0.1);
}

/* Syntax highlighting */
:deep(.cm-keyword) { color: #569cd6; }
:deep(.cm-operator) { color: #d4d4d4; }
:deep(.cm-string) { color: #ce9178; }
:deep(.cm-number) { color: #b5cea8; }
:deep(.cm-comment) { color: #6a9955; }
:deep(.cm-meta) { color: #d4d4d4; }
:deep(.cm-tag) { color: #569cd6; }
:deep(.cm-attribute) { color: #9cdcfe; }
</style>