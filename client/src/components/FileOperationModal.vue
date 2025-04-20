<template>
  <Modal v-model="isOpen" :title="getModalTitle()">
    <div class="operation-modal-content">
      <!-- Operation type selection -->
      <div class="form-group operation-type">
        <div class="operation-buttons">
          <button 
            @click="switchMode('file')" 
            class="operation-button" 
            :class="{ active: mode === 'file' }"
          >
            <span class="icon">📄</span>
            <span>New File</span>
          </button>
          <button 
            @click="switchMode('folder')" 
            class="operation-button" 
            :class="{ active: mode === 'folder' }"
          >
            <span class="icon">📁</span>
            <span>New Folder</span>
          </button>
          <button 
            @click="switchMode('upload')" 
            class="operation-button" 
            :class="{ active: mode === 'upload' }"
          >
            <span class="icon">⬆️</span>
            <span>Upload File</span>
          </button>
        </div>
      </div>

      <!-- Path input (common to all operations) -->
      <div class="form-group">
        <label class="form-label">Path:</label>
        <input 
          type="text" 
          v-model="filePath" 
          :placeholder="getPathPlaceholder()"
          class="form-control"
          ref="pathInput"
          @keyup.enter="submit"
        />
      </div>

      <!-- Upload file selector (only shown in upload mode) -->
      <div class="form-group" v-if="mode === 'upload'">
        <label class="form-label">Select File:</label>
        <input 
          type="file" 
          @change="handleFileSelected" 
          ref="fileInput" 
          class="form-control" 
        />
      </div>
    </div>
    <template #footer>
      <div class="d-flex justify-content-end gap-2">
        <base-button @click="cancel" variant="secondary">Cancel</base-button>
        <base-button 
          @click="submit" 
          variant="primary" 
          :disabled="!canSubmit"
        >
          {{ getSubmitButtonText() }}
        </base-button>
      </div>
    </template>
  </Modal>
</template>

<script>
import { ref, computed, nextTick } from 'vue';
import Modal from './Modal.vue';
import BaseButton from './BaseButton.vue';

export default {
  name: 'FileOperationModal',
  components: { Modal, BaseButton },
  props: {
    initialPath: {
      type: String,
      default: ''
    },
    initialMode: {
      type: String,
      default: 'file', // 'file', 'folder', or 'upload'
      validator: value => ['file', 'folder', 'upload'].includes(value)
    }
  },
  emits: ['submit', 'cancel'],
  setup(props) {
    const isOpen = ref(false);
    const mode = ref(props.initialMode);
    const filePath = ref(props.initialPath);
    const fileInput = ref(null);
    const pathInput = ref(null);
    const selectedFile = ref(null);

    // Switch between operation modes
    const switchMode = (newMode) => {
      mode.value = newMode;
      // If switching to upload mode and a file was previously selected, clear it
      if (newMode === 'upload') {
        if (fileInput.value) {
          fileInput.value.value = ''; // Clear the file input
        }
        selectedFile.value = null;
      }
    };

    // Handle file selection for uploads
    const handleFileSelected = (event) => {
      const file = event.target.files[0];
      selectedFile.value = file || null;
      
      // Auto-fill path with the filename if not provided
      if (file && filePath.value.endsWith('/')) {
        filePath.value += file.name;
      }
    };

    // Computed property to determine if submission is possible
    const canSubmit = computed(() => {
      if (!filePath.value.trim()) return false;
      
      if (mode.value === 'upload') {
        return !!selectedFile.value;
      }
      
      return true;
    });

    // Get modal title based on current mode
    const getModalTitle = () => {
      switch (mode.value) {
        case 'file':
          return 'Create New File';
        case 'folder':
          return 'Create New Folder';
        case 'upload':
          return 'Upload File';
        default:
          return 'Add File / Folder';
      }
    };

    // Get placeholder text for path input
    const getPathPlaceholder = () => {
      switch (mode.value) {
        case 'file':
          return 'e.g., filename.yml';
        case 'folder':
          return 'e.g., new-folder';
        case 'upload':
          return 'e.g., images/file.jpg';
        default:
          return '';
      }
    };

    // Get submit button text
    const getSubmitButtonText = () => {
      switch (mode.value) {
        case 'upload':
          return 'Upload';
        default:
          return 'Create';
      }
    };

    // Show modal with specified settings
    const show = (initialMode = 'file', initialPath = '') => {
      filePath.value = initialPath;
      selectedFile.value = null;
      isOpen.value = true;
      console.log(initialMode);
      switchMode(initialMode);
      
      // Focus path input after opening
      nextTick(() => {
        if (pathInput.value) {
          pathInput.value.focus();
        }
      });
      
      return new Promise((resolve) => {
        resolvePromise = resolve;
      });
    };

    // Cancel and close modal
    const cancel = () => {
      isOpen.value = false;
      if (resolvePromise) {
        resolvePromise({ canceled: true });
      }
    };

    // Submit the operation
    const submit = async () => {
      if (!canSubmit.value) return;
      
      let content = '';
      
      // For upload mode, read the file content
      if (mode.value === 'upload' && selectedFile.value) {
        try {
          content = await readFileAsText(selectedFile.value);
        } catch (error) {
          // If we can't read as text, it's likely a binary file
          // In this case, we'll just pass an empty string and handle it on the server side
          console.error('Error reading file:', error);
        }
      }
      
      isOpen.value = false;
      
      if (resolvePromise) {
        resolvePromise({
          canceled: false,
          mode: mode.value,
          path: filePath.value,
          file: selectedFile.value,
          content
        });
      }
    };

    // Helper function to read file as text
    const readFileAsText = (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
      });
    };

    let resolvePromise = null;

    return {
      isOpen,
      mode,
      filePath,
      fileInput,
      pathInput,
      selectedFile,
      canSubmit,
      switchMode,
      handleFileSelected,
      getModalTitle,
      getPathPlaceholder,
      getSubmitButtonText,
      show,
      cancel,
      submit
    };
  }
}
</script>

<style scoped>
.operation-modal-content {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
}

.operation-type {
  margin-bottom: 1.5rem;
}

.operation-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: space-between;
}

.operation-button {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem 0.5rem;
  border: 1px solid #ddd;
  background-color: #f8f8f8;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #333;
}

.operation-button:hover {
  background-color: #f0f0f0;
  border-color: #ccc;
}

.operation-button.active {
  border-color: #007bff;
  background-color: rgba(0, 123, 255, 0.1);
  color: #007bff;
  font-weight: 500;
}

.operation-button .icon {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
}

.form-control {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #fff;
  color: #333;
  font-size: 0.9rem;
}

.form-control:focus {
  border-color: #80bdff;
  outline: 0;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

input[type="file"].form-control {
  padding: 0.375rem;
  line-height: 1.5;
}

.d-flex {
  display: flex;
}

.justify-content-end {
  justify-content: flex-end;
}

.gap-2 {
  gap: 0.5rem;
}
</style>