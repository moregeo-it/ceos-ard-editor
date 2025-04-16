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
import * as monaco from 'monaco-editor';
import loader from '@monaco-editor/loader';

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
    let editor = null;
    let monacoLoaded = false;
    
    // Determine language from filename
    const getLanguage = () => {
      if (!props.filename) return 'plaintext';
      
      const extension = props.filename.split('.').pop().toLowerCase();
      
      switch (extension) {
        case 'md':
          return 'markdown';
        case 'yaml':
        case 'yml':
          return 'yaml';
        case 'json':
          return 'json';
        case 'html':
          return 'html';
        case 'js':
          return 'javascript';
        case 'css':
          return 'css';
        case 'txt':
          return 'plaintext';
        default:
          return 'plaintext';
      }
    };
    
    // Configure YAML language if needed
    const configureYamlLanguage = () => {
      if (!monaco.languages.getLanguages().find(lang => lang.id === 'yaml')) {
        monaco.languages.register({ id: 'yaml' });
        
        // Basic YAML syntax highlighting definition
        monaco.languages.setMonarchTokensProvider('yaml', {
          tokenizer: {
            root: [
              [/^(\s*)([a-zA-Z0-9_-]+)(:)(\s*)(.*)$/, ['white', 'key', 'delimiter', 'white', 'value']],
              [/^(\s*)(-\s+)(.*)$/, ['white', 'delimiter', 'value']],
              [/#.*$/, 'comment'],
              [/"([^"\\]|\\.)*$/, 'string.invalid'],
              [/'([^'\\]|\\.)*$/, 'string.invalid'],
              [/"/, 'string', '@string_double'],
              [/'/, 'string', '@string_single'],
              [/[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?/, 'number'],
              [/\b(true|false|null)\b/, 'keyword']
            ],
            string_double: [
              [/[^\\"]+/, 'string'],
              [/\\./, 'string.escape'],
              [/"/, 'string', '@pop']
            ],
            string_single: [
              [/[^\\']+/, 'string'],
              [/\\./, 'string.escape'],
              [/'/, 'string', '@pop']
            ]
          }
        });
        
        // Simple YAML completion provider
        monaco.languages.registerCompletionItemProvider('yaml', {
          provideCompletionItems: () => {
            const suggestions = [
              {
                label: 'name:',
                kind: monaco.languages.CompletionItemKind.Property,
                insertText: 'name: ',
                detail: 'Property name'
              },
              {
                label: 'version:',
                kind: monaco.languages.CompletionItemKind.Property,
                insertText: 'version: ',
                detail: 'Version identifier'
              },
              {
                label: 'description:',
                kind: monaco.languages.CompletionItemKind.Property,
                insertText: 'description: ',
                detail: 'Description text'
              },
              {
                label: '- item',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: '- ',
                detail: 'List item'
              }
            ];
            
            return { suggestions };
          }
        });
      }
    };
    
    // Simple YAML validation
    const validateYaml = (content) => {
      if (!editor) return;
      
      try {
        const language = getLanguage();
        if (language !== 'yaml') return;
        
        // Perform basic YAML validation
        // Check for common issues like incorrect indentation
        const lines = content.split('\n');
        const markers = [];
        
        let inSequence = false;
        let previousIndent = 0;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmedLine = line.trimStart();
          const indent = line.length - trimmedLine.length;
          
          // Skip empty lines and comments
          if (trimmedLine === '' || trimmedLine.startsWith('#')) continue;
          
          // Check for incorrect colons
          if (trimmedLine.includes(':') && !trimmedLine.includes(': ') && 
              !trimmedLine.endsWith(':') && !trimmedLine.includes('http:') && !trimmedLine.includes('https:')) {
            markers.push({
              severity: monaco.MarkerSeverity.Error,
              message: 'Missing space after colon',
              startLineNumber: i + 1,
              startColumn: line.indexOf(':') + 1,
              endLineNumber: i + 1,
              endColumn: line.indexOf(':') + 2
            });
          }
          
          // Check for tabs instead of spaces
          if (line.includes('\t')) {
            markers.push({
              severity: monaco.MarkerSeverity.Warning,
              message: 'Tab character found, consider using spaces for indentation',
              startLineNumber: i + 1,
              startColumn: line.indexOf('\t') + 1,
              endLineNumber: i + 1,
              endColumn: line.indexOf('\t') + 2
            });
          }
          
          // Check for inconsistent indentation
          if (indent % 2 !== 0) {
            markers.push({
              severity: monaco.MarkerSeverity.Warning,
              message: 'Inconsistent indentation (not a multiple of 2 spaces)',
              startLineNumber: i + 1,
              startColumn: 1,
              endLineNumber: i + 1,
              endColumn: indent + 1
            });
          }
          
          // Check for sequence markers (- ) without proper indentation
          if (trimmedLine.startsWith('- ') && indent <= previousIndent && inSequence) {
            if (indent < previousIndent) {
              // End of sequence, reset
              inSequence = false;
            } else {
              // Same indentation but unexpected - marker
              markers.push({
                severity: monaco.MarkerSeverity.Info,
                message: 'Sequence item at same indentation level',
                startLineNumber: i + 1,
                startColumn: 1,
                endLineNumber: i + 1,
                endColumn: 3
              });
            }
          } else if (trimmedLine.startsWith('- ')) {
            inSequence = true;
          }
          
          previousIndent = indent;
        }
        
        // Set markers on the model
        if (editor && editor.getModel()) {
          monaco.editor.setModelMarkers(editor.getModel(), 'yaml-validation', markers);
        }
      } catch (err) {
        console.error('Error validating YAML:', err);
      }
    };
    
    // Save file function for the save button
    const saveFile = () => {
      emit('save');
    };
    
    // Initialize Monaco editor
    const initEditor = async () => {
      if (!editorContainer.value) return;
      
      // Dispose existing editor if it exists
      if (editor) {
        editor.dispose();
      }
      
      try {
        // Ensure Monaco is loaded
        if (!monacoLoaded) {
          await loader.init();
          monacoLoaded = true;
          
          // Configure YAML language once Monaco is loaded
          configureYamlLanguage();
        }
        
        // Create new editor
        editor = monaco.editor.create(editorContainer.value, {
          value: props.modelValue,
          language: getLanguage(),
          theme: 'vs',
          automaticLayout: true,
          minimap: {
            enabled: false // Disable the minimap/code preview on the right side
          },
          lineNumbers: 'on',
          fontSize: 14,
          fontFamily: 'Consolas, "Courier New", monospace',
          scrollBeyondLastLine: false,
          tabSize: 2,
          wordWrap: 'on',
          renderWhitespace: 'all',
          formatOnPaste: true,
          fixedOverflowWidgets: true, // Prevent widgets from creating scrollbars
          contextmenu: true
        });
        
        // Listen for content changes
        editor.onDidChangeModelContent(() => {
          const content = editor.getValue();
          emit('update:modelValue', content);
          
          // Validate YAML content
          validateYaml(content);
        });
        
        // Listen for save keyboard shortcut (Ctrl+S)
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
          emit('save');
        });
        
        // Force layout refresh
        setTimeout(() => {
          if (editor) {
            editor.layout();
            
            // Initial validation
            validateYaml(props.modelValue);
          }
        }, 100);
      } catch (err) {
        console.error('Error initializing Monaco editor:', err);
      }
    };
    
    // Handle editor updates when props change
    watch(() => props.modelValue, (newVal) => {
      if (editor && editor.getValue() !== newVal) {
        editor.setValue(newVal);
        validateYaml(newVal);
      }
    });
    
    // Update editor language when filename changes and reinitialize editor
    watch(() => props.filename, () => {
      nextTick(() => {
        // Re-initialize the editor when the file changes
        initEditor();
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
      if (editor) {
        editor.dispose();
      }
    });
    
    return {
      editorContainer,
      saveFile
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

.code-editor-container .cm-diagnostic-error {
  /* Style for the error underlines in CodeMirror */
  text-decoration: underline wavy #3b82f6;
  position: relative;
}

.code-editor-container .cm-diagnostic-error:hover::after {
  content: attr(data-error);
  position: absolute;
  left: 0;
  bottom: 100%;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 0.25rem;
  padding: 0.5rem;
  color: #dc3545;
  z-index: 1000;
  white-space: nowrap;
  font-size: 0.875rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
}
</style>