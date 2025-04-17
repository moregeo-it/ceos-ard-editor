<template>
  <div class="code-editor-container">
    <div class="editor-header">
      <div class="file-info">
        <h3 class="file-name">{{ filename || 'Untitled' }}</h3>
        
        <!-- PFS References Dropdown -->
        <div v-if="isRequirementFile" class="pfs-references">
          <span class="pfs-label">Used in:</span>
          <select class="pfs-select">
            <option v-for="pfs in pfsReferences" :key="pfs" :value="pfs">{{ pfs }}</option>
          </select>
        </div>
        
        <button @click="saveFile" class="save-button">Save</button>
      </div>
    </div>
    <div ref="editorContainer" class="editor-container"></div>
  </div>
</template>

<script>
import { ref, watch, onMounted, onBeforeUnmount, nextTick, computed } from 'vue';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { yaml } from '@codemirror/lang-yaml';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';

const API_URL = 'http://localhost:3000/api';

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
    
    // References to PFS documents
    const pfsReferences = ref([]);
    
    // Check if the file is a requirement file
    const isRequirementFile = computed(() => {
      return props.filename?.startsWith('requirements/') && props.filename?.endsWith('.yaml');
    });
    
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
    
    // Fetch PFS references for requirement files
    const fetchPFSReferences = async () => {
      if (!isRequirementFile.value) {
        pfsReferences.value = [];
        return;
      }
      
      try {
        const workspaceId = localStorage.getItem('workspaceId');
        if (!workspaceId) return;
        
        const response = await fetch(
          `${API_URL}/file/pfs-references?requirementPath=${encodeURIComponent(props.filename)}`,
          {
            headers: {
              'workspace-id': workspaceId
            }
          }
        );
        
        const data = await response.json();
        
        if (data.success) {
          pfsReferences.value = data.pfsDocuments || [];
        }
      } catch (error) {
        console.error('Error fetching PFS references:', error);
        pfsReferences.value = [];
      }
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
        
        // Fetch PFS references when filename changes
        fetchPFSReferences();
      });
    });
    
    // Set up editor on mount
    onMounted(() => {
      // Initialize editor after the DOM is ready
      nextTick(() => {
        initEditor();
        
        // Initial PFS references fetch
        fetchPFSReferences();
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
      getDisplayFilename,
      isRequirementFile,
      pfsReferences
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
  flex-grow: 1;
  margin-right: 0.5rem;
}

.pfs-references {
  display: flex;
  align-items: center;
  margin-right: auto;
  flex-grow: 1;
}

.pfs-label {
  font-size: 0.9rem;
  color: #666;
  margin-right: 0.5rem;
}

.pfs-select {
  padding: 0.25rem;
  font-size: 0.9rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
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
  flex: 0 0 auto;
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