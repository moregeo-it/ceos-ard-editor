<template>
  <div class="file-tree-directory" :class="{ 'root-level': rootLevel }">
    <!-- Show controls for all directories -->
    <div class="directory-controls">
      <button @click="createNewFile" class="small-button">New File</button>
      <button @click="uploadFile" class="small-button">Upload</button>
      <button @click="refreshDirectory" class="small-button">⟳</button>
    </div>
    
    <div v-if="loading" class="loading">Loading...</div>
    <div v-else-if="error" class="error">Error loading directory</div>
    <div v-else-if="files.length === 0" class="empty">
      {{ rootLevel ? "No files found" : "Empty directory" }}
    </div>
    <div v-else>
      <div v-for="file in sortedFiles" :key="file.path" class="file-item">
        <div 
          class="file-entry"
          :class="{ 'is-directory': file.isDirectory }"
          @click="handleFileClick(file)"
        >
          <span class="icon">{{ file.isDirectory ? '📁' : getFileIcon(file.name) }}</span>
          <span class="name">{{ file.name }}</span>
          
          <div class="file-actions">
            <button @click.stop="showFileOptions(file)" class="action-button">⋮</button>
          </div>
        </div>
        
        <div v-if="file.isDirectory && expandedDirs[file.path]" class="subdirectory">
          <file-tree-directory
            :path="file.path"
            @select-file="$emit('select-file', $event)"
            @refresh="refreshDirectory"
          />
        </div>
      </div>
    </div>
    
    <!-- File options menu modal -->
    <div v-if="showFileMenu" class="file-menu-modal" @click.self="showFileMenu = false">
      <div class="file-menu" :style="fileMenuPosition">
        <button @click="renameFile" class="menu-item">Rename</button>
        <button @click="deleteFile" class="menu-item">Delete</button>
        <button @click="copyFile" class="menu-item">Copy</button>
        <button @click="moveFile" class="menu-item">Move</button>
      </div>
    </div>
    
    <!-- Rename File Dialog -->
    <div class="modal" v-if="showRenameDialog">
      <div class="modal-content">
        <h3>Rename {{ selectedFile ? selectedFile.name : '' }}</h3>
        <div class="form-group">
          <label>New name:</label>
          <input type="text" v-model="newFileName" placeholder="Enter new name" />
        </div>
        <div class="form-actions">
          <button @click="cancelRename" class="secondary-button">Cancel</button>
          <button @click="confirmRename" class="primary-button">Rename</button>
        </div>
      </div>
    </div>
    
    <!-- Move File Dialog -->
    <div class="modal" v-if="showMoveDialog">
      <div class="modal-content">
        <h3>Move {{ selectedFile ? selectedFile.name : '' }}</h3>
        <div class="form-group">
          <label>Destination path:</label>
          <input type="text" v-model="destinationPath" placeholder="e.g., folder/" />
        </div>
        <div class="form-actions">
          <button @click="cancelMove" class="secondary-button">Cancel</button>
          <button @click="confirmMove" class="primary-button">Move</button>
        </div>
      </div>
    </div>
    
    <!-- Copy File Dialog -->
    <div class="modal" v-if="showCopyDialog">
      <div class="modal-content">
        <h3>Copy {{ selectedFile ? selectedFile.name : '' }}</h3>
        <div class="form-group">
          <label>Destination path:</label>
          <input type="text" v-model="destinationPath" placeholder="e.g., folder/newname.yml" />
        </div>
        <div class="form-actions">
          <button @click="cancelCopy" class="secondary-button">Cancel</button>
          <button @click="confirmCopy" class="primary-button">Copy</button>
        </div>
      </div>
    </div>
    
    <!-- New File Dialog -->
    <div class="modal" v-if="showNewFileDialog">
      <div class="modal-content">
        <h3>Create New File</h3>
        <div class="form-group">
          <label>File Path:</label>
          <input type="text" v-model="newFilePath" placeholder="e.g., filename.yml" />
        </div>
        <div class="form-actions">
          <button @click="cancelNewFile" class="secondary-button">Cancel</button>
          <button @click="confirmNewFile" class="primary-button">Create</button>
        </div>
      </div>
    </div>
    
    <!-- File Upload Dialog -->
    <div class="modal" v-if="showUploadDialog">
      <div class="modal-content">
        <h3>Upload File</h3>
        <div class="form-group">
          <label>Destination Path:</label>
          <input type="text" v-model="uploadPath" placeholder="e.g., images/file.jpg" />
        </div>
        <div class="form-group">
          <label>Select File:</label>
          <input type="file" @change="handleFileSelected" ref="fileInput" />
        </div>
        <div class="form-actions">
          <button @click="cancelUpload" class="secondary-button">Cancel</button>
          <button @click="confirmUpload" class="primary-button" :disabled="!selectedFileToUpload">Upload</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, nextTick } from 'vue';

const API_URL = 'http://localhost:3000/api';

export default {
  name: 'FileTreeDirectory',
  props: {
    path: {
      type: String,
      required: true
    },
    rootLevel: {
      type: Boolean,
      default: false
    }
  },
  emits: ['select-file', 'refresh'],
  setup(props, { emit }) {
    const files = ref([]);
    const loading = ref(true);
    const error = ref(false);
    const expandedDirs = ref({});
    
    // File operations state
    const selectedFile = ref(null);
    const showFileMenu = ref(false);
    const fileMenuPosition = ref({ top: '0px', left: '0px' });
    const showRenameDialog = ref(false);
    const showMoveDialog = ref(false);
    const showCopyDialog = ref(false);
    const showNewFileDialog = ref(false);
    const showUploadDialog = ref(false);
    
    // Form values
    const newFileName = ref('');
    const destinationPath = ref('');
    const newFilePath = ref('');
    const uploadPath = ref('');
    const selectedFileToUpload = ref(null);
    const fileInput = ref(null);
    
    const loadDirectory = async () => {
      loading.value = true;
      error.value = false;
      
      try {
        const workspaceId = localStorage.getItem('workspaceId');
        if (!workspaceId) {
          error.value = true;
          return;
        }
        
        const response = await fetch(`${API_URL}/file/list?dir=${encodeURIComponent(props.path)}`, {
          headers: {
            'workspace-id': workspaceId
          }
        });
        
        const data = await response.json();
        
        if (data.success) {
          files.value = data.files;
        } else {
          error.value = true;
          console.error('Failed to load directory:', data.message);
        }
      } catch (err) {
        error.value = true;
        console.error('Error loading directory:', err);
      } finally {
        loading.value = false;
      }
    };
    
    const refreshDirectory = () => {
      // Always reload the directory data
      loadDirectory();
      
      // For root level, also emit refresh to parent for any additional refresh tasks
      if (props.rootLevel) {
        emit('refresh');
      }
    };
    
    const sortedFiles = computed(() => {
      return [...files.value].sort((a, b) => {
        // Directories first
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        
        // Then alphabetically
        return a.name.localeCompare(b.name);
      });
    });
    
    const handleFileClick = (file) => {
      if (file.isDirectory) {
        // Toggle directory expansion
        expandedDirs.value[file.path] = !expandedDirs.value[file.path];
      } else {
        // Emit selected file
        emit('select-file', file.path);
      }
    };
    
    const getFileIcon = (filename) => {
      const extension = filename.split('.').pop().toLowerCase();
      
      switch (extension) {
        case 'md':
          return '📝'; // Markdown
        case 'yaml':
        case 'yml':
          return '📊'; // YAML
        case 'json':
          return '📋'; // JSON
        case 'html':
          return '📄'; // HTML
        case 'js':
          return '📜'; // JavaScript
        case 'css':
          return '🎨'; // CSS
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
          return '🖼️'; // Image
        case 'pdf':
          return '📕'; // PDF
        default:
          return '📄'; // Default file icon
      }
    };
    
    // Handle showing file options menu
    const showFileOptions = (file) => {
      selectedFile.value = file;
      showFileMenu.value = true;
      
      // Position the menu near the clicked element
      nextTick(() => {
        const rect = event.target.getBoundingClientRect();
        fileMenuPosition.value = {
          top: `${rect.bottom + window.scrollY}px`,
          left: `${rect.left + window.scrollX}px`
        };
      });
    };
    
    // Rename file handlers
    const renameFile = () => {
      if (!selectedFile.value) return;
      
      showFileMenu.value = false;
      newFileName.value = selectedFile.value.name;
      showRenameDialog.value = true;
    };
    
    const cancelRename = () => {
      showRenameDialog.value = false;
      newFileName.value = '';
    };
    
    const confirmRename = async () => {
      if (!selectedFile.value || !newFileName.value.trim()) return;
      
      try {
        const workspaceId = localStorage.getItem('workspaceId');
        
        // Get old file path and new file path
        const oldPath = selectedFile.value.path;
        const pathParts = oldPath.split('/');
        pathParts.pop(); // Remove the old filename
        const newPath = pathParts.length > 0 
          ? `${pathParts.join('/')}/${newFileName.value}`
          : newFileName.value;
        
        const response = await fetch(`${API_URL}/file/rename`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'workspace-id': workspaceId
          },
          body: JSON.stringify({
            oldPath,
            newPath
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          // Update successful, refresh file tree
          refreshDirectory();
          showRenameDialog.value = false;
          newFileName.value = '';
        } else {
          alert(`Failed to rename file: ${data.message}`);
        }
      } catch (error) {
        console.error('Error renaming file:', error);
        alert('Failed to rename file. Check console for details.');
      }
    };
    
    // Delete file handlers
    const deleteFile = async () => {
      if (!selectedFile.value) return;
      showFileMenu.value = false;
      
      if (!confirm(`Are you sure you want to delete ${selectedFile.value.name}?`)) {
        return;
      }
      
      try {
        const workspaceId = localStorage.getItem('workspaceId');
        
        const response = await fetch(`${API_URL}/file/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'workspace-id': workspaceId
          },
          body: JSON.stringify({
            filePath: selectedFile.value.path
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          // Delete successful, refresh file tree
          refreshDirectory();
        } else {
          alert(`Failed to delete file: ${data.message}`);
        }
      } catch (error) {
        console.error('Error deleting file:', error);
        alert('Failed to delete file. Check console for details.');
      }
    };
    
    // Move file handlers
    const moveFile = () => {
      if (!selectedFile.value) return;
      
      showFileMenu.value = false;
      destinationPath.value = '';
      showMoveDialog.value = true;
    };
    
    const cancelMove = () => {
      showMoveDialog.value = false;
      destinationPath.value = '';
    };
    
    const confirmMove = async () => {
      if (!selectedFile.value || !destinationPath.value.trim()) return;
      
      try {
        const workspaceId = localStorage.getItem('workspaceId');
        
        const sourcePath = selectedFile.value.path;
        let destPath = destinationPath.value;
        
        // If destination is a directory path (ends with /) append the original filename
        if (destPath.endsWith('/')) {
          destPath += selectedFile.value.name;
        }
        
        const response = await fetch(`${API_URL}/file/move`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'workspace-id': workspaceId
          },
          body: JSON.stringify({
            sourcePath,
            destPath
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          // Move successful, refresh file tree
          refreshDirectory();
          showMoveDialog.value = false;
          destinationPath.value = '';
        } else {
          alert(`Failed to move file: ${data.message}`);
        }
      } catch (error) {
        console.error('Error moving file:', error);
        alert('Failed to move file. Check console for details.');
      }
    };
    
    // Copy file handlers
    const copyFile = () => {
      if (!selectedFile.value) return;
      
      showFileMenu.value = false;
      destinationPath.value = '';
      showCopyDialog.value = true;
    };
    
    const cancelCopy = () => {
      showCopyDialog.value = false;
      destinationPath.value = '';
    };
    
    const confirmCopy = async () => {
      if (!selectedFile.value || !destinationPath.value.trim()) return;
      
      try {
        const workspaceId = localStorage.getItem('workspaceId');
        
        const sourcePath = selectedFile.value.path;
        let destPath = destinationPath.value;
        
        // If destination is a directory path (ends with /) append the original filename
        if (destPath.endsWith('/')) {
          destPath += selectedFile.value.name;
        }
        
        const response = await fetch(`${API_URL}/file/copy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'workspace-id': workspaceId
          },
          body: JSON.stringify({
            sourcePath,
            destPath
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          // Copy successful, refresh file tree
          refreshDirectory();
          showCopyDialog.value = false;
          destinationPath.value = '';
        } else {
          alert(`Failed to copy file: ${data.message}`);
        }
      } catch (error) {
        console.error('Error copying file:', error);
        alert('Failed to copy file. Check console for details.');
      }
    };
    
    // New file handlers
    const createNewFile = () => {
      showNewFileDialog.value = true;
      newFilePath.value = '';
    };
    
    const cancelNewFile = () => {
      showNewFileDialog.value = false;
      newFilePath.value = '';
    };
    
    const confirmNewFile = async () => {
      if (!newFilePath.value.trim()) {
        alert('Please enter a file path');
        return;
      }
      
      try {
        const workspaceId = localStorage.getItem('workspaceId');
        
        // Prepend current directory path to new file path if not an absolute path
        let fullPath = newFilePath.value;
        if (!newFilePath.value.startsWith('/') && props.path) {
          fullPath = `${props.path}/${newFilePath.value}`;
        }
        
        const response = await fetch(`${API_URL}/file/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'workspace-id': workspaceId
          },
          body: JSON.stringify({
            filePath: fullPath,
            content: ''
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          showNewFileDialog.value = false;
          refreshDirectory();
          // Open the new file for editing
          emit('select-file', fullPath);
        } else {
          alert(`Failed to create file: ${data.message}`);
        }
      } catch (error) {
        console.error('Error creating file:', error);
        alert('Failed to create file. Check console for details.');
      }
    };
    
    // File upload handlers
    const uploadFile = () => {
      showUploadDialog.value = true;
      uploadPath.value = '';
      selectedFileToUpload.value = null;
    };
    
    const cancelUpload = () => {
      showUploadDialog.value = false;
      uploadPath.value = '';
      selectedFileToUpload.value = null;
    };
    
    const handleFileSelected = (event) => {
      const file = event.target.files[0];
      selectedFileToUpload.value = file || null;
    };
    
    const confirmUpload = async () => {
      if (!uploadPath.value.trim() || !selectedFileToUpload.value) {
        alert('Please select a file and enter a destination path');
        return;
      }
      
      try {
        const workspaceId = localStorage.getItem('workspaceId');
        
        const formData = new FormData();
        formData.append('file', selectedFileToUpload.value);
        formData.append('filePath', uploadPath.value);
        
        const response = await fetch(`${API_URL}/file/upload`, {
          method: 'POST',
          headers: {
            'workspace-id': workspaceId
          },
          body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
          showUploadDialog.value = false;
          refreshDirectory();
        } else {
          alert(`Failed to upload file: ${data.message}`);
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        alert('Failed to upload file. Check console for details.');
      }
    };
    
    onMounted(loadDirectory);
    
    return {
      files,
      loading,
      error,
      expandedDirs,
      sortedFiles,
      handleFileClick,
      getFileIcon,
      refreshDirectory,
      
      // File operations
      selectedFile,
      showFileMenu,
      fileMenuPosition,
      showFileOptions,
      
      // Rename
      showRenameDialog,
      newFileName,
      renameFile,
      cancelRename,
      confirmRename,
      
      // Delete
      deleteFile,
      
      // Move
      showMoveDialog,
      destinationPath,
      moveFile,
      cancelMove,
      confirmMove,
      
      // Copy
      showCopyDialog,
      copyFile,
      cancelCopy,
      confirmCopy,
      
      // New file
      showNewFileDialog,
      newFilePath,
      createNewFile,
      cancelNewFile,
      confirmNewFile,
      
      // Upload file
      showUploadDialog,
      uploadPath,
      selectedFileToUpload,
      fileInput,
      uploadFile,
      cancelUpload,
      handleFileSelected,
      confirmUpload
    };
  }
};
</script>

<style scoped>
.file-tree-directory {
  margin-top: 0.15rem;
}

.file-tree-directory.root-level {
  margin-top: 0;
}

.directory-controls {
  display: flex;
  margin-bottom: 0.75rem;
  gap: 0.3rem;
}

.file-item {
  margin-bottom: 0.15rem;
}

.file-entry {
  display: flex;
  align-items: center;
  padding: 0.3rem 0.5rem;
  border-radius: 3px;
  cursor: pointer;
  user-select: none;
  font-size: 0.9rem;
  justify-content: space-between;
}

.file-entry:hover {
  background-color: #f0f0f0;
}

.file-entry.is-directory {
  font-weight: bold;
}

.icon {
  margin-right: 0.4rem;
  font-size: 0.9rem;
}

.name {
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-actions {
  display: flex;
  align-items: center;
  visibility: hidden;
}

.file-entry:hover .file-actions {
  visibility: visible;
}

.action-button {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
}

.action-button:hover {
  background-color: #ddd;
  color: #333;
}

.subdirectory {
  margin-left: 1.2rem;
  border-left: 1px solid #ddd;
  padding-left: 0.4rem;
}

.loading, .error, .empty {
  padding: 0.4rem;
  font-size: 0.85rem;
  color: #777;
}

.error {
  color: #d73a49;
}

.small-button {
  font-size: 0.8rem;
  padding: 0.25rem 0.5rem;
}

/* File operations menu */
.file-menu-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 100;
}

.file-menu {
  position: absolute;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  min-width: 120px;
  z-index: 101;
}

.menu-item {
  padding: 0.5rem 1rem;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  color: #333; /* Ensuring text is visible against white background */
}

.menu-item:hover {
  background-color: #f5f5f5;
}

/* Modal dialogs */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-content {
  background-color: white;
  padding: 1.5rem;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  width: 400px;
  max-width: 90%;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
}

.form-group input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

.secondary-button {
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  cursor: pointer;
}

.secondary-button:hover {
  background-color: #5a6268;
}

.primary-button {
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  cursor: pointer;
}

.primary-button:hover {
  background-color: #0069d9;
}

.directory-tree {
  width: 100%;
  overflow: visible; /* Allow content to flow naturally */
}
</style>