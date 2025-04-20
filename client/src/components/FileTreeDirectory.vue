<template>
  <div class="file-tree-directory">
    <!-- Search bar - only show at root level -->
    <div v-if="!path" class="search-container">
      <input 
        type="text" 
        v-model="searchQuery" 
        placeholder="Search files..." 
        class="form-control search-input" 
        @keyup.enter="performSearch"
      />
      <button @click="performSearch" class="search-button">
        🔍
      </button>
      <button 
        v-if="isSearchActive" 
        @click="clearSearch" 
        class="clear-search-button"
        title="Clear search"
      >
        ✖
      </button>
    </div>
    
    <!-- Search results - only show at root level -->
    <div v-if="!path && isSearchActive" class="search-results">
      <div class="search-results-header">
        <span>Search results for "{{ searchQuery }}"</span>
        <span v-if="searchResults.hasMoreResults" class="more-results-indicator">
          (showing first 100 results)
        </span>
      </div>
      
      <div v-if="searchResults.loading" class="loading">Searching...</div>
      <div v-else-if="searchResults.error" class="error">{{ searchResults.error }}</div>
      <div v-else-if="searchResults.results.length === 0" class="empty">
        No results found
      </div>
      <div v-else class="search-results-list">
        <div 
          v-for="result in searchResults.results" 
          :key="result.path" 
          class="search-result-item"
          @click="handleResultClick(result)"
        >
          <span class="icon">{{ result.isDirectory ? '📁' : getFileIcon(result.name) }}</span>
          <div class="result-details">
            <span class="name">{{ result.name }}</span>
            <span class="path">{{ result.path }}</span>
            <div v-if="result.matchType === 'content'" class="match-info">
              <span class="match-type">Content match</span>
              <div class="text-extract" v-if="result.extract">{{ result.extract }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Show controls for all directories when not searching -->
    <div v-if="!isSearchActive" class="directory-controls">
      <base-button @click="createNewFile" size="small" variant="outline">New File</base-button>
      <base-button @click="createNewFolder" size="small" variant="outline">New Folder</base-button>
      <base-button @click="uploadFile" size="small" variant="outline">Upload</base-button>
      <base-button @click="refreshDirectory" size="small" variant="outline" title="Reload">⟳</base-button>
    </div>
    
    <!-- Regular file tree (shown when not searching or for non-root levels) -->
    <div v-if="!isSearchActive">
      <div v-if="loading" class="loading">Loading...</div>
      <div v-else-if="error" class="error">Error loading directory</div>
      <div v-else-if="files.length === 0" class="empty">
        No files found
      </div>
      <div v-else>
        <div v-for="file in sortedFiles" :key="file.path" class="file-item" :data-file-path="file.path">
          <div 
            class="file-entry"
            :class="{ 
              'is-directory': file.isDirectory,
              'is-changed': !file.isDirectory && file.gitStatus && file.gitStatus !== 'A',
              'is-deleted': file.isDeleted,
              'is-added': !file.isDirectory && file.gitStatus === 'A'
            }"
            @click="handleFileClick(file)"
            :data-file-path="file.path"
          >
            <span class="icon">{{ file.isDirectory ? '📁' : getFileIcon(file.name) }}</span>
            <span class="name" 
              :class="{ 
                'deleted-file': file.isDeleted, 
                'added-file': !file.isDirectory && file.gitStatus === 'A'
              }"
            >{{ file.name }}</span>
            
            <div class="file-actions">
              <span v-if="!file.isDirectory && file.gitStatus" 
                class="change-indicator" 
                :title="getGitStatusLabel(file.gitStatus)"
                :class="{ 'added-indicator': file.gitStatus === 'A' }"
              >{{ file.gitStatus }}</span>
              <button @click.stop="showFileOptions(file, $event)" class="action-button">⋮</button>
            </div>
          </div>
          
          <div v-if="file.isDirectory && expandedDirs[file.path]" class="subdirectory">
            <file-tree-directory
              :path="file.path"
              :currentOpenFile="currentOpenFile"
              @select-file="$emit('select-file', $event)"
              @refresh="refreshDirectory"
              @update-current-file="$emit('update-current-file', $event)"
              @file-operation-loading="$emit('file-operation-loading', $event)"
              @file-operation-complete="$emit('file-operation-complete')"
            />
          </div>
        </div>
      </div>
    </div>
    
    <!-- File options menu modal -->
    <div v-if="showFileMenu" class="file-menu-modal" @click.self="showFileMenu = false">
      <div class="file-menu" :style="fileMenuPosition">
        <button v-if="selectedFile && selectedFile.gitStatus" @click="revertFileChanges" class="menu-item">Revert Changes</button>
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
          <label class="form-label">New name:</label>
          <input 
            type="text" 
            v-model="newFileName" 
            placeholder="Enter new name" 
            class="form-control"
            ref="renameInput"
            @keyup.enter="confirmRename"
          />
        </div>
        <div class="d-flex justify-content-end gap-2">
          <base-button @click="cancelRename" variant="secondary">Cancel</base-button>
          <base-button @click="confirmRename" variant="primary">Rename</base-button>
        </div>
      </div>
    </div>
    
    <!-- Move File Dialog -->
    <div class="modal" v-if="showMoveDialog">
      <div class="modal-content">
        <h3>Move {{ selectedFile ? selectedFile.name : '' }}</h3>
        <div class="form-group">
          <label class="form-label">Destination path:</label>
          <input 
            type="text" 
            v-model="destinationPath" 
            placeholder="e.g., folder/" 
            class="form-control"
            ref="moveInput"
            @keyup.enter="confirmMove"
          />
        </div>
        <div class="d-flex justify-content-end gap-2">
          <base-button @click="cancelMove" variant="secondary">Cancel</base-button>
          <base-button @click="confirmMove" variant="primary">Move</base-button>
        </div>
      </div>
    </div>
    
    <!-- Copy File Dialog -->
    <div class="modal" v-if="showCopyDialog">
      <div class="modal-content">
        <h3>Copy {{ selectedFile ? selectedFile.name : '' }}</h3>
        <div class="form-group">
          <label class="form-label">Destination path:</label>
          <input 
            type="text" 
            v-model="destinationPath" 
            placeholder="e.g., folder/newname.yml" 
            class="form-control"
            ref="copyInput"
            @keyup.enter="confirmCopy"
          />
        </div>
        <div class="d-flex justify-content-end gap-2">
          <base-button @click="cancelCopy" variant="secondary">Cancel</base-button>
          <base-button @click="confirmCopy" variant="primary">Copy</base-button>
        </div>
      </div>
    </div>
    
    <!-- New File Dialog -->
    <div class="modal" v-if="showNewFileDialog">
      <div class="modal-content">
        <h3>Create New File</h3>
        <div class="form-group">
          <label class="form-label">File Path:</label>
          <input 
            type="text" 
            v-model="newFilePath" 
            placeholder="e.g., filename.yml" 
            class="form-control"
            ref="newFileInput"
            @keyup.enter="confirmNewFile"
          />
        </div>
        <div class="d-flex justify-content-end gap-2">
          <base-button @click="cancelNewFile" variant="secondary">Cancel</base-button>
          <base-button @click="confirmNewFile" variant="primary">Create</base-button>
        </div>
      </div>
    </div>
    
    <!-- New Folder Dialog -->
    <div class="modal" v-if="showNewFolderDialog">
      <div class="modal-content">
        <h3>Create New Folder</h3>
        <div class="form-group">
          <label class="form-label">Folder Path:</label>
          <input 
            type="text" 
            v-model="newFolderPath" 
            placeholder="e.g., new-folder" 
            class="form-control"
            ref="newFolderInput"
            @keyup.enter="confirmNewFolder"
          />
        </div>
        <div class="d-flex justify-content-end gap-2">
          <base-button @click="cancelNewFolder" variant="secondary">Cancel</base-button>
          <base-button @click="confirmNewFolder" variant="primary">Create</base-button>
        </div>
      </div>
    </div>
    
    <!-- File Upload Dialog -->
    <div class="modal" v-if="showUploadDialog">
      <div class="modal-content">
        <h3>Upload File</h3>
        <div class="form-group">
          <label class="form-label">Destination Path:</label>
          <input 
            type="text" 
            v-model="uploadPath" 
            placeholder="e.g., images/file.jpg" 
            class="form-control"
            ref="uploadPathInput"
            @keyup.enter="confirmUpload"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Select File:</label>
          <input type="file" @change="handleFileSelected" ref="fileInput" class="form-control" />
        </div>
        <div class="d-flex justify-content-end gap-2">
          <base-button @click="cancelUpload" variant="secondary">Cancel</base-button>
          <base-button @click="confirmUpload" variant="primary" :disabled="!selectedFileToUpload">Upload</base-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, inject, onMounted, nextTick, watch, provide } from 'vue';
import { API_URL } from '../config.js';
import api from '../services/auth.js';
import BaseButton from './BaseButton.vue';

export default {
  name: 'FileTreeDirectory',
  components: {
    BaseButton
  },
  props: {
    path: {
      type: String,
      required: true
    },
    currentOpenFile: {
      type: String,
      default: ''
    }
  },
  emits: ['select-file', 'refresh', 'update-current-file', 'file-operation-loading', 'file-operation-complete'],
  setup(props, { emit }) {
    const files = ref([]);
    const loading = ref(true);
    const error = ref(false);
    const expandedDirs = ref({});
    
    // Get changedFiles from parent App component
    const parentChangedFiles = inject('changedFiles', {});
    
    // Inject modal functions from App.vue
    const showAlert = inject('showAlert');
    const showConfirm = inject('showConfirm');
    
    // File operations state
    const selectedFile = ref(null);
    const showFileMenu = ref(false);
    const fileMenuPosition = ref({ top: '0px', left: '0px' });
    const showNewFileDialog = ref(false);
    const showUploadDialog = ref(false);
    const showRenameDialog = ref(false);
    const showMoveDialog = ref(false);
    const showCopyDialog = ref(false);
    const showNewFolderDialog = ref(false);
    
    // Form values
    const newFilePath = ref('');
    const uploadPath = ref('');
    const selectedFileToUpload = ref(null);
    const fileInput = ref(null);
    const newFileName = ref('');
    const destinationPath = ref('');
    const newFolderPath = ref('');
    
    // Search functionality
    const searchQuery = ref('');
    const isSearchActive = ref(false);
    const searchResults = ref({
      results: [],
      loading: false,
      error: null,
      hasMoreResults: false
    });
    
    const changedFiles = ref({});

    // Loading state
    const isLoading = ref(false);
    
    const showLoading = (message = 'Processing...') => {
      isLoading.value = true;
      emit('file-operation-loading', message);
    };

    const hideLoading = () => {
      isLoading.value = false;
      emit('file-operation-complete');
    };
    
    // Load directory data and include changed files information
    const loadDirectory = async () => {
      loading.value = true;
      error.value = false;
      
      try {
        const workspaceId = localStorage.getItem('workspaceId');
        if (!workspaceId) {
          error.value = true;
          return;
        }
        
        const response = await api.get(`/file/list?dir=${encodeURIComponent(props.path)}`, {
          headers: {
            'workspace-id': workspaceId
          }
        });
        
        const data = response.data;
        
        if (data.success) {
          files.value = data.files;
          changedFiles.value = data.changedFiles || {};
          
          // If we're at the root directory, emit a refresh to update parent components
          if (!props.path) {
            emit('refresh', { changedFiles: changedFiles.value });
          }
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
      
      // Also emit refresh event to parent component to ensure the entire tree is updated
      emit('refresh');
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
          return '📋'; // YAML
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
          return '🖼️'; // Image
        default:
          return '📄'; // Default file icon
      }
    };
    
    const isFileChanged = (filePath) => {
      return changedFiles.value[filePath] !== undefined;
    };
    
    const getFileChangeStatus = (filePath) => {
      return changedFiles.value[filePath] || 'unknown';
    };

    const getGitStatusLabel = (status) => {
      if (status === 'M') return 'Modified';
      if (status === 'A') return 'Added';
      if (status === 'D') return 'Deleted';
      if (status === 'R') return 'Renamed';
      if (status === 'C') return 'Copied';
      if (status === 'U') return 'Updated';
      return status; // Return the status code if no specific label
    };
    
    const revertFileChanges = async () => {
      if (!selectedFile.value) return;
      showFileMenu.value = false;
      
      const confirmed = await showConfirm(
        `Are you sure you want to revert changes to ${selectedFile.value.name}? This will discard all your changes.`,
        'Revert Changes',
        'Revert'
      );
      
      if (!confirmed) {
        return;
      }
      
      try {
        showLoading('Reverting file changes...');
        const workspaceId = localStorage.getItem('workspaceId');
        
        const response = await api.post('/file/revert', {
          filePath: selectedFile.value.path
        }, {
          headers: {
            'Content-Type': 'application/json',
            'workspace-id': workspaceId
          }
        });
        
        const data = response.data;
        
        if (data.success) {
          // Refresh the file tree to reflect the reverted changes
          refreshDirectory();
          
          // If the reverted file is currently open, reload it
          if (props.currentOpenFile === selectedFile.value.path) {
            emit('select-file', selectedFile.value.path);
          }
          
          // Clear the selected file
          selectedFile.value = null;
        } else {
          showAlert(`Failed to revert file changes: ${data.message}`, 'Error');
        }
      } catch (error) {
        console.error('Error reverting file changes:', error);
        showAlert('Failed to revert file changes. Check console for details.', 'Error');
      } finally {
        hideLoading();
      }
    };
    
    // Handle showing file options menu
    const showFileOptions = (file, event) => {
      event.stopPropagation();
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
    
    // New file handlers
    const newFileInput = ref(null);
    const createNewFile = () => {
      showNewFileDialog.value = true;
      newFilePath.value = props.path ? props.path + '/' : '';
      nextTick(() => {
        if (newFileInput.value) {
          newFileInput.value.focus();
        }
      });
    };
    
    const cancelNewFile = () => {
      showNewFileDialog.value = false;
      newFilePath.value = '';
    };
    
    const confirmNewFile = async () => {
      if (!newFilePath.value.trim()) {
        showAlert('Please enter a file path', 'Error');
        return;
      }
      
      try {
        showLoading('Creating file...');
        const workspaceId = localStorage.getItem('workspaceId');
        
        // Prepend current directory path to new file path if not an absolute path
        let fullPath = newFilePath.value;
        if (!newFilePath.value.startsWith('/') && props.path && !fullPath.includes('/')) {
          fullPath = `${props.path}/${newFilePath.value}`;
        }
        
        const response = await api.post('/file/save', {
          filePath: fullPath,
          content: ''
        }, {
          headers: {
            'Content-Type': 'application/json',
            'workspace-id': workspaceId
          }
        });
        
        const data = response.data;
        
        if (data.success) {
          showNewFileDialog.value = false;
          refreshDirectory();
          // Open the new file for editing
          emit('select-file', fullPath);
        } else {
          showAlert(`Failed to create file: ${data.message}`, 'Error');
        }
      } catch (error) {
        console.error('Error creating file:', error);
        showAlert('Failed to create file. Check console for details.', 'Error');
      } finally {
        hideLoading();
      }
    };
    
    // New folder handlers
    const newFolderInput = ref(null);
    const createNewFolder = () => {
      showNewFolderDialog.value = true;
      newFolderPath.value = props.path ? props.path + '/' : '';
      nextTick(() => {
        if (newFolderInput.value) {
          newFolderInput.value.focus();
        }
      });
    };
    
    const cancelNewFolder = () => {
      showNewFolderDialog.value = false;
      newFolderPath.value = '';
    };
    
    const confirmNewFolder = async () => {
      if (!newFolderPath.value.trim()) {
        showAlert('Please enter a folder path', 'Error');
        return;
      }
      
      try {
        showLoading('Creating folder...');
        const workspaceId = localStorage.getItem('workspaceId');
        
        // Prepend current directory path to new folder path if not an absolute path
        let fullPath = newFolderPath.value;
        if (!newFolderPath.value.startsWith('/') && props.path && !fullPath.includes('/')) {
          fullPath = `${props.path}/${newFolderPath.value}`;
        }
        
        const response = await api.post('/file/create-folder', {
          folderPath: fullPath
        }, {
          headers: {
            'Content-Type': 'application/json',
            'workspace-id': workspaceId
          }
        });
        
        const data = response.data;
        
        if (data.success) {
          showNewFolderDialog.value = false;
          refreshDirectory();
        } else {
          showAlert(`Failed to create folder: ${data.message}`, 'Error');
        }
      } catch (error) {
        console.error('Error creating folder:', error);
        showAlert('Failed to create folder. Check console for details.', 'Error');
      } finally {
        hideLoading();
      }
    };
    
    // File upload handlers
    const uploadPathInput = ref(null);
    const uploadFile = () => {
      showUploadDialog.value = true;
      uploadPath.value = props.path ? props.path + '/' : '';
      selectedFileToUpload.value = null;
      nextTick(() => {
        if (uploadPathInput.value) {
          uploadPathInput.value.focus();
        }
      });
    };
    
    const cancelUpload = () => {
      showUploadDialog.value = false;
      uploadPath.value = '';
      selectedFileToUpload.value = null;
    };
    
    const handleFileSelected = (event) => {
      const file = event.target.files[0];
      selectedFileToUpload.value = file || null;
      
      // Auto-fill uploadPath with the filename if not provided
      if (file && uploadPath.value.endsWith('/')) {
        uploadPath.value += file.name;
      }
    };
    
    const confirmUpload = async () => {
      if (!uploadPath.value.trim() || !selectedFileToUpload.value) {
        showAlert('Please select a file and enter a destination path', 'Error');
        return;
      }
      
      try {
        showLoading('Uploading file...');
        const workspaceId = localStorage.getItem('workspaceId');
        
        const reader = new FileReader();
        reader.onload = async (e) => {
          const content = e.target.result;
          
          const response = await api.post('/file/upload', {
            path: uploadPath.value,
            content
          }, {
            headers: {
              'Content-Type': 'application/json',
              'workspace-id': workspaceId
            }
          });
          
          const data = response.data;
          if (data.success) {
            showUploadDialog.value = false;
            refreshDirectory();
            
            // Open the uploaded file
            emit('select-file', uploadPath.value);
          } else {
            showAlert(`Failed to upload file: ${data.message}`, 'Error');
          }
          hideLoading();
        };
        
        reader.readAsText(selectedFileToUpload.value);
      } catch (error) {
        console.error('Error uploading file:', error);
        showAlert('Failed to upload file. Check console for details.', 'Error');
        hideLoading();
      }
    };
    
    // Rename file handlers
    const renameInput = ref(null);
    const renameFile = () => {
      if (!selectedFile.value) return;
      
      showFileMenu.value = false;
      newFileName.value = selectedFile.value.name;
      showRenameDialog.value = true;
      nextTick(() => {
        if (renameInput.value) {
          renameInput.value.focus();
        }
      });
    };
    
    const cancelRename = () => {
      showRenameDialog.value = false;
      newFileName.value = '';
    };
    
    const confirmRename = async () => {
      if (!selectedFile.value || !newFileName.value.trim()) return;
      
      try {
        showLoading('Renaming file...');
        const workspaceId = localStorage.getItem('workspaceId');
        
        // Get old file path and new file path
        const oldPath = selectedFile.value.path;
        const pathParts = oldPath.split('/');
        pathParts.pop(); // Remove the old filename
        const newPath = pathParts.length > 0 
          ? `${pathParts.join('/')}/${newFileName.value}`
          : newFileName.value;
        
        const response = await api.post('/file/rename', {
          oldPath,
          newPath
        }, {
          headers: {
            'Content-Type': 'application/json',
            'workspace-id': workspaceId
          }
        });
        
        const data = response.data;
        
        if (data.success) {
          // If the renamed file is currently open, update the current file path
          if (props.currentOpenFile === oldPath) {
            emit('update-current-file', { oldPath, newPath });
          }
          
          // Update successful, refresh file tree
          refreshDirectory();
          showRenameDialog.value = false;
          newFileName.value = '';
        } else {
          showAlert(`Failed to rename file: ${data.message}`, 'Error');
        }
      } catch (error) {
        console.error('Error renaming file:', error);
        showAlert('Failed to rename file. Check console for details.', 'Error');
      } finally {
        hideLoading();
      }
    };
    
    // Delete file handlers
    const deleteFile = async () => {
      if (!selectedFile.value) return;
      showFileMenu.value = false;
      
      const confirmed = await showConfirm(
        `Are you sure you want to delete ${selectedFile.value.name}?`, 
        'Delete File',
        'Delete'
      );
      
      if (!confirmed) {
        return;
      }
      
      try {
        showLoading('Deleting file...');
        const workspaceId = localStorage.getItem('workspaceId');
        
        const response = await api.post('/file/delete', {
          filePath: selectedFile.value.path
        }, {
          headers: {
            'Content-Type': 'application/json',
            'workspace-id': workspaceId
          }
        });
        
        const data = response.data;
        
        if (data.success) {
          // If the deleted file is currently open, close it
          if (props.currentOpenFile === selectedFile.value.path) {
            emit('update-current-file', { oldPath: selectedFile.value.path, newPath: '' });
          }
          
          // Delete successful, refresh file tree
          refreshDirectory();
          
          // Clear the selected file
          selectedFile.value = null;
        } else {
          showAlert(`Failed to delete file: ${data.message}`, 'Error');
        }
      } catch (error) {
        console.error('Error deleting file:', error);
        showAlert('Failed to delete file. Check console for details.', 'Error');
      } finally {
        hideLoading();
      }
    };
    
    // Move file handlers
    const moveInput = ref(null);
    const moveFile = () => {
      if (!selectedFile.value) return;
      
      showFileMenu.value = false;
      destinationPath.value = '';
      showMoveDialog.value = true;
      nextTick(() => {
        if (moveInput.value) {
          moveInput.value.focus();
        }
      });
    };
    
    const cancelMove = () => {
      showMoveDialog.value = false;
      destinationPath.value = '';
    };
    
    const confirmMove = async () => {
      if (!selectedFile.value || !destinationPath.value.trim()) return;
      
      try {
        showLoading('Moving file...');
        const workspaceId = localStorage.getItem('workspaceId');
        
        const sourcePath = selectedFile.value.path;
        let destPath = destinationPath.value;
        
        // If destination is a directory path (ends with /) append the original filename
        if (destPath.endsWith('/')) {
          destPath += selectedFile.value.name;
        }
        
        const response = await api.post('/file/move', {
          sourcePath,
          destPath
        }, {
          headers: {
            'Content-Type': 'application/json',
            'workspace-id': workspaceId
          }
        });
        
        const data = response.data;
        
        if (data.success) {
          // If the moved file is currently open, update the current file path
          if (props.currentOpenFile === sourcePath) {
            emit('update-current-file', { oldPath: sourcePath, newPath: destPath });
          }
          
          // Move successful, refresh file tree
          refreshDirectory();
          showMoveDialog.value = false;
          destinationPath.value = '';
        } else {
          showAlert(`Failed to move file: ${data.message}`, 'Error');
        }
      } catch (error) {
        console.error('Error moving file:', error);
        showAlert('Failed to move file. Check console for details.', 'Error');
      } finally {
        hideLoading();
      }
    };
    
    // Copy file handlers
    const copyInput = ref(null);
    const copyFile = () => {
      if (!selectedFile.value) return;
      
      showFileMenu.value = false;
      destinationPath.value = '';
      showCopyDialog.value = true;
      nextTick(() => {
        if (copyInput.value) {
          copyInput.value.focus();
        }
      });
    };
    
    const cancelCopy = () => {
      showCopyDialog.value = false;
      destinationPath.value = '';
    };
    
    const confirmCopy = async () => {
      if (!selectedFile.value || !destinationPath.value.trim()) return;
      
      try {
        showLoading('Copying file...');
        const workspaceId = localStorage.getItem('workspaceId');
        
        const sourcePath = selectedFile.value.path;
        let destPath = destinationPath.value;
        
        // If destination is a directory path (ends with /) append the original filename
        if (destPath.endsWith('/')) {
          destPath += selectedFile.value.name;
        }
        
        const response = await api.post('/file/copy', {
          sourcePath,
          destPath
        }, {
          headers: {
            'Content-Type': 'application/json',
            'workspace-id': workspaceId
          }
        });
        
        const data = response.data;
        
        if (data.success) {
          // Copy successful, refresh file tree and changed files list
          refreshDirectory();
          
          showCopyDialog.value = false;
          destinationPath.value = '';
          
          // Open the newly copied file
          if (data.newFilePath || destPath) {
            const newFilePath = data.newFilePath || destPath;
            emit('select-file', newFilePath);
          }
        } else {
          showAlert(`Failed to copy file: ${data.message}`, 'Error');
        }
      } catch (error) {
        console.error('Error copying file:', error);
        showAlert('Failed to copy file. Check console for details.', 'Error');
      } finally {
        hideLoading();
      }
    };
    
    // Search functionality
    const performSearch = async () => {
      if (!searchQuery.value.trim()) {
        clearSearch();
        return;
      }
      
      isSearchActive.value = true;
      searchResults.value.loading = true;
      searchResults.value.error = null;
      searchResults.value.results = [];
      
      try {
        const workspaceId = localStorage.getItem('workspaceId');
        if (!workspaceId) {
          searchResults.value.error = 'No workspace selected';
          return;
        }
        
        const response = await api.get(
          `/file/search?query=${encodeURIComponent(searchQuery.value)}`, 
          {
            headers: {
              'workspace-id': workspaceId
            }
          }
        );
        
        const data = response.data;
        
        if (data.success) {
          searchResults.value.results = data.results;
          searchResults.value.hasMoreResults = data.hasMoreResults;
        } else {
          searchResults.value.error = data.message || 'Failed to perform search';
        }
      } catch (error) {
        console.error('Error performing search:', error);
        searchResults.value.error = 'Error performing search';
      } finally {
        searchResults.value.loading = false;
      }
    };
    
    const clearSearch = () => {
      isSearchActive.value = false;
      searchQuery.value = '';
      searchResults.value.results = [];
      searchResults.value.error = null;
      searchResults.value.loading = false;
    };
    
    const handleResultClick = (result) => {
      if (result.isDirectory) {
        // Navigate to the directory
        // For simplicity, we just open the file tree to that directory
        const pathParts = result.path.split('/');
        let currentPath = '';
        
        // Expand each directory in the path
        for (let i = 0; i < pathParts.length - 1; i++) {
          if (pathParts[i]) {
            if (currentPath) {
              currentPath += '/';
            }
            currentPath += pathParts[i];
            expandedDirs.value[currentPath] = true;
          }
        }
        
        // Finally, emit select-file to highlight the directory
        emit('select-file', result.path);
        
        // Optionally clear search after navigating
        clearSearch();
      } else {
        // It's a file, open it directly
        emit('select-file', result.path);
        
        // Optionally clear search after opening a file
        clearSearch();
      }
    };

    // Expand the file tree to show a specific file path and scroll to it
    const expandToShowFile = async (filePath) => {
      if (!filePath) return;
      
      // Only process if this is the root directory or the path includes this directory
      if (props.path && !filePath.startsWith(props.path + '/')) return;

      // If we're currently loading, wait for data to be loaded first
      if (loading.value) {
        await new Promise(resolve => {
          const unwatch = watch(loading, (newVal) => {
            if (newVal === false) {
              unwatch();
              resolve();
            }
          });
        });
      }
      
      const pathParts = filePath.split('/');
      let currentPath = '';
      
      // Expand each directory in the path
      for (let i = 0; i < pathParts.length - 1; i++) {
        if (pathParts[i]) {
          if (currentPath) {
            currentPath += '/';
          }
          currentPath += pathParts[i];
          expandedDirs.value[currentPath] = true;
        }
      }
      
      // After expanding directories, wait for DOM update and then scroll to the file
      await nextTick();
      
      // Try to find the file element in the DOM
      let attempts = 0;
      const maxAttempts = 5;
      
      const tryScroll = () => {
        attempts++;
        scrollToActiveFile(filePath);
        
        // If we couldn't find the element and haven't reached max attempts
        // try again after a short delay
        const fileElement = document.querySelector(`[data-file-path="${filePath}"]`);
        if (!fileElement && attempts < maxAttempts) {
          setTimeout(tryScroll, 100 * attempts); // Increase delay with each attempt
        }
      };
      
      tryScroll();
    };
    
    // Scroll to the active file in the file tree
    const scrollToActiveFile = (filePath) => {
      if (!filePath) return;
      
      // Find the file element in the DOM
      const fileElement = document.querySelector(`[data-file-path="${filePath}"]`);
      if (fileElement) {
        // Scroll the file element into view with smooth behavior
        fileElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Briefly highlight the element to make it more visible to the user
        fileElement.classList.add('highlight-file');
        setTimeout(() => {
          fileElement.classList.remove('highlight-file');
        }, 2000); // Remove highlight after 2 seconds
      }
    };
    
    // Watch for changes in the currentOpenFile prop
    watch(() => props.currentOpenFile, (newFilePath, oldFilePath) => {
      if (newFilePath && newFilePath !== oldFilePath) {
        // Expand the directories to make the file visible and scroll to it
        expandToShowFile(newFilePath);
      }
    });

    // Watch for changes in changedFiles from parent component
    watch(() => parentChangedFiles, (newChangedFiles) => {
      // When changedFiles is updated from parent, refresh the directory
      if (Object.keys(newChangedFiles).length > 0) {
        loadDirectory();
      }
    }, { deep: true });
    
    // Refresh directory on @refresh event from parent
    provide('refreshDirectory', refreshDirectory);
    
    onMounted(() => {
      loadDirectory();
      
      // If there's already a current open file, make sure it's visible and scrolled into view
      if (props.currentOpenFile) {
        expandToShowFile(props.currentOpenFile);
      }
    });
    
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
      
      // New file
      showNewFileDialog,
      newFilePath,
      newFileInput,
      createNewFile,
      cancelNewFile,
      confirmNewFile,
      
      // New folder
      showNewFolderDialog,
      newFolderPath,
      newFolderInput,
      createNewFolder,
      cancelNewFolder,
      confirmNewFolder,
      
      // Upload file
      showUploadDialog,
      uploadPath,
      selectedFileToUpload,
      fileInput,
      uploadPathInput,
      uploadFile,
      cancelUpload,
      handleFileSelected,
      confirmUpload,
      
      // Rename file
      showRenameDialog,
      newFileName,
      renameInput,
      renameFile,
      cancelRename,
      confirmRename,
      
      // Move file
      showMoveDialog,
      destinationPath,
      moveInput,
      moveFile,
      cancelMove,
      confirmMove,
      
      // Copy file
      showCopyDialog,
      copyInput,
      copyFile,
      cancelCopy,
      confirmCopy,
      
      // Delete file
      deleteFile,
      
      // Changed files
      isFileChanged,
      getFileChangeStatus,
      getGitStatusLabel,
      revertFileChanges,
      
      // Search functionality
      searchQuery,
      isSearchActive,
      searchResults,
      performSearch,
      clearSearch,
      handleResultClick,
      
      // Expand file tree
      expandToShowFile
    };
  }
};
</script>

<style scoped>
.file-tree-directory {
  margin-top: 0.15rem;
}

.directory-controls {
  display: flex;
  margin-bottom: 0.75rem;
  gap: 0.2rem;
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

.file-entry.is-changed {
  background-color: #fff3cd;
}

.file-entry.is-deleted {
  background-color: #f8d7da;
}

.file-entry.is-added {
  background-color: #d4edda;
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

.name.deleted-file {
  text-decoration: line-through;
  color: #d9534f;
}

.name.added-file {
  font-weight: bold;
  color: #28a745;
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

.change-indicator {
  color: #d9534f;
  font-weight: bold;
  margin-right: 0.5rem;
}

.change-indicator.added-indicator {
  color: #28a745;
}

/* Make sure file changes are always visible, even without hovering */
.file-entry .file-actions .change-indicator {
  visibility: visible;
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

/* Update form input styles to match utility classes */
.search-input {
  flex-grow: 1;
  padding: 0.4rem 2rem 0.4rem 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.9rem;
  width: auto;
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

.directory-tree {
  width: 100%;
  overflow: visible; /* Allow content to flow naturally */
}

/* Search related styles */
.search-container {
  display: flex;
  margin-bottom: 0.75rem;
  position: relative;
}

.search-input {
  flex-grow: 1;
  padding: 0.4rem 2rem 0.4rem 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.9rem;
}

.search-button {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  background: none;
  border: none;
  padding: 0 0.5rem;
  cursor: pointer;
  color: #666;
}

.clear-search-button {
  position: absolute;
  right: 1.5rem;
  top: 0;
  bottom: 0;
  background: none;
  border: none;
  padding: 0 0.5rem;
  cursor: pointer;
  color: #666;
  font-size: 0.8rem;
}

.search-results {
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 0.75rem;
  background-color: #f8f8f8;
  max-height: 60vh;
  overflow-y: auto;
}

.search-results-header {
  padding: 0.5rem;
  font-weight: bold;
  border-bottom: 1px solid #ddd;
  background-color: #f0f0f0;
  font-size: 0.9rem;
  display: flex;
  justify-content: space-between;
}

.more-results-indicator {
  font-style: italic;
  font-weight: normal;
  font-size: 0.8rem;
  color: #666;
}

.search-results-list {
  padding: 0.5rem 0;
}

.search-result-item {
  padding: 0.5rem;
  cursor: pointer;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: flex-start;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background-color: #f0f0f0;
}

.result-details {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: hidden;
}

.result-details .name {
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-details .path {
  font-size: 0.8rem;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.match-info {
  margin-top: 0.3rem;
  display: flex;
  flex-direction: column;
}

.match-type {
  font-size: 0.75rem;
  color: #0066cc;
}

.text-extract {
  font-size: 0.85rem;
  color: #333;
  margin-top: 0.2rem;
  position: relative;
  background-color: #f2f5f8;
  padding: 0.5rem;
  border-radius: 4px;
  border-left: 3px solid #0066cc;
  font-family: monospace;
  white-space: normal;
  overflow-wrap: break-word;
  word-break: break-word;
  max-height: 8rem;
  overflow-y: auto;
}

.highlight-file {
  background-color: rgba(0,0,0, 0.25) !important;
}
</style>