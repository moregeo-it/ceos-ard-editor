<template>
  <div class="app-container">
    <!-- Loading overlay for async operations (moved to bottom right corner) -->
    <div v-if="isLoading" class="loading-notification">
      <div class="loading-spinner"></div>
      <div class="loading-text">{{ loadingMessage }}</div>
    </div>

    <!-- Workspace creation/management -->
    <div class="workspace-controls" v-if="!workspaceId">
      <h1>CEOS-ARD Editor</h1>
      <button @click="createWorkspace" :disabled="isCreatingWorkspace">
        {{ isCreatingWorkspace ? 'Creating workspace...' : 'Create New Workspace' }}
      </button>
    </div>

    <!-- Main editor layout -->
    <div class="editor-layout" v-else>
      <!-- Top toolbar -->
      <div class="toolbar">
        <h2>CEOS-ARD Editor</h2>
        <div class="actions">
          <button @click="copyWorkspaceUrl" class="copy-url">Copy URL</button>
          <button @click="closeWorkspace" class="danger">Close Workspace</button>
        </div>
      </div>

      <!-- Three-column layout -->
      <div class="columns-container">
        <!-- Left column: File tree -->
        <div class="column file-tree" :style="{ width: leftPanelWidth + 'px' }">
          <div class="file-tree-header">
            <h3>Files</h3>
            <!-- File tree controls -->
            <div class="directory-controls">
              <button @click="createNewFile" class="small-button">New File</button>
              <button @click="handleUploadFile" class="small-button">Upload</button>
              <button @click="loadFileTree" class="small-button">⟳</button>
            </div>
          </div>
          <div class="file-list">
            <!-- File tree content -->
            <div class="file-tree-directory">
              <div v-if="loadingFiles" class="loading">Loading...</div>
              <div v-else-if="fileTreeError" class="error">Error loading files</div>
              <div v-else-if="files.length === 0" class="empty">No files found</div>
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
                      @select-file="openFile"
                      @refresh="loadFileTree"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Resize handle for left panel -->
        <div 
          class="resize-handle"
          @mousedown="startResizeLeft"
        ></div>

        <!-- Middle column: Code editor -->
        <div class="column code-editor" :style="{ width: middlePanelWidth + 'px' }">
          <code-editor 
            v-if="currentFile"
            v-model="fileContent"
            :filename="currentFile"
            @save="saveFile"
          />
          <div v-else class="no-file-selected">
            Select a file to edit
          </div>
        </div>
        
        <!-- Resize handle for middle panel -->
        <div 
          class="resize-handle"
          @mousedown="startResizeMiddle"
        ></div>

        <!-- Right column: Preview -->
        <div class="column preview-pane">
          <div class="preview-header">
            <h3>Preview</h3>
            <div class="preview-selector" v-if="previewFiles.length > 0">
              <select v-model="selectedPreview" @change="loadPreview">
                <option v-for="file in previewFiles" :key="file.path" :value="file.name">
                  {{ file.name.replace('.html', '') }}
                </option>
              </select>
            </div>
          </div>
          <div v-if="!previewFiles.length" class="no-preview">
            No previews available. Save your changes to generate a preview.
          </div>
          <preview-pane 
            v-if="selectedPreview && previewContent"
            :content="previewContent"
          />
        </div>
      </div>
    </div>
    
    <!-- File operations modals -->
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
          <input type="text" v-model="newFilePath" placeholder="e.g., folder/filename.yml" />
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
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import FileTreeDirectory from './components/FileTreeDirectory.vue';
import CodeEditor from './components/CodeEditor.vue';
import PreviewPane from './components/PreviewPane.vue';

const API_URL = 'http://localhost:3000/api';

export default {
  name: 'App',
  components: {
    FileTreeDirectory,
    CodeEditor,
    PreviewPane
  },
  setup() {
    // Workspace state
    const workspaceId = ref(localStorage.getItem('workspaceId') || '');
    const isCreatingWorkspace = ref(false);
    const isGeneratingPreview = ref(false);

    // File browser state
    const files = ref([]);
    const loadingFiles = ref(true);
    const fileTreeError = ref(false);
    const currentFile = ref('');
    const fileContent = ref('');
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

    // Preview state
    const previewFiles = ref([]);
    const selectedPreview = ref('');
    const previewContent = ref('');
    
    // Panel resize state
    const leftPanelWidth = ref(250);
    const middlePanelWidth = ref(window.innerWidth * 0.4);
    const isResizingLeft = ref(false);
    const isResizingMiddle = ref(false);

    // Loading state
    const isLoading = ref(false);
    const loadingMessage = ref('');

    const showLoading = (message = 'Processing...') => {
      isLoading.value = true;
      loadingMessage.value = message;
    };

    const hideLoading = () => {
      isLoading.value = false;
      loadingMessage.value = '';
    };

    // Create a new workspace
    const createWorkspace = async () => {
      try {
        isCreatingWorkspace.value = true;
        const response = await fetch(`${API_URL}/workspace/create`, {
          method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
          workspaceId.value = data.workspaceId;
          localStorage.setItem('workspaceId', data.workspaceId);
          
          // Update URL with workspace ID for sharing
          const url = new URL(window.location.href);
          url.searchParams.set('workspace', data.workspaceId);
          window.history.replaceState({}, '', url);
          
          loadFileTree();
        } else {
          alert(`Failed to create workspace: ${data.message}`);
        }
      } catch (error) {
        console.error('Error creating workspace:', error);
        alert('Failed to create workspace. Check console for details.');
      } finally {
        isCreatingWorkspace.value = false;
      }
    };
    
    // Copy current workspace URL to clipboard for sharing
    const copyWorkspaceUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.set('workspace', workspaceId.value);
      navigator.clipboard.writeText(url.toString())
        .then(() => {
          alert('Workspace URL copied to clipboard!');
        })
        .catch(err => {
          console.error('Could not copy URL: ', err);
          alert('Failed to copy URL. You can manually share this URL.');
        });
    };

    // Close and delete the workspace
    const closeWorkspace = async () => {
      if (!confirm('Are you sure you want to close this workspace? All changes will be lost.')) {
        return;
      }
      
      try {
        const response = await fetch(`${API_URL}/workspace/${workspaceId.value}`, {
          method: 'DELETE',
          headers: {
            'workspace-id': workspaceId.value
          }
        });
        
        const data = await response.json();
        
        if (data.success) {
          workspaceId.value = '';
          localStorage.removeItem('workspaceId');
          currentFile.value = '';
          fileContent.value = '';
          files.value = [];
          previewFiles.value = [];
          selectedPreview.value = '';
          previewContent.value = '';
          
          // Remove workspace ID from URL
          const url = new URL(window.location.href);
          url.searchParams.delete('workspace');
          window.history.replaceState({}, '', url);
        } else {
          alert(`Failed to close workspace: ${data.message}`);
        }
      } catch (error) {
        console.error('Error closing workspace:', error);
        alert('Failed to close workspace. Check console for details.');
      }
    };

    // File tree functionality
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
        // Open the file
        openFile(file.path);
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

    // Load file tree
    const loadFileTree = async () => {
      loadingFiles.value = true;
      fileTreeError.value = false;
      
      try {
        const response = await fetch(`${API_URL}/file/list?dir=`, {
          headers: {
            'workspace-id': workspaceId.value
          }
        });
        
        const data = await response.json();
        
        if (data.success) {
          files.value = data.files;
        } else {
          fileTreeError.value = true;
          alert(`Failed to load file tree: ${data.message}`);
        }
      } catch (error) {
        fileTreeError.value = true;
        console.error('Error loading file tree:', error);
      } finally {
        loadingFiles.value = false;
      }
    };

    // Open a file for editing
    const openFile = async (filePath) => {
      try {
        showLoading('Loading file...');
        const response = await fetch(`${API_URL}/file/content?filePath=${encodeURIComponent(filePath)}`, {
          headers: {
            'workspace-id': workspaceId.value
          }
        });
        
        const data = await response.json();
        
        if (data.success) {
          currentFile.value = filePath;
          fileContent.value = data.content;
        } else {
          alert(`Failed to open file: ${data.message}`);
        }
      } catch (error) {
        console.error('Error opening file:', error);
      } finally {
        hideLoading();
      }
    };

    // Save current file
    const saveFile = async () => {
      if (!currentFile.value) return;
      
      try {
        showLoading('Saving file...');
        const response = await fetch(`${API_URL}/file/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'workspace-id': workspaceId.value
          },
          body: JSON.stringify({
            filePath: currentFile.value,
            content: fileContent.value
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          // Automatically generate preview after saving
          await generatePreview();
        } else {
          alert(`Failed to save file: ${data.message}`);
        }
      } catch (error) {
        console.error('Error saving file:', error);
        alert('Failed to save file. Check console for details.');
      } finally {
        hideLoading();
      }
    };
    
    // File operations
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
        showLoading('Renaming file...');
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
          loadFileTree();
          showRenameDialog.value = false;
          newFileName.value = '';
        } else {
          alert(`Failed to rename file: ${data.message}`);
        }
      } catch (error) {
        console.error('Error renaming file:', error);
        alert('Failed to rename file. Check console for details.');
      } finally {
        hideLoading();
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
        showLoading('Deleting file...');
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
          loadFileTree();
        } else {
          alert(`Failed to delete file: ${data.message}`);
        }
      } catch (error) {
        console.error('Error deleting file:', error);
        alert('Failed to delete file. Check console for details.');
      } finally {
        hideLoading();
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
        showLoading('Moving file...');
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
          loadFileTree();
          showMoveDialog.value = false;
          destinationPath.value = '';
        } else {
          alert(`Failed to move file: ${data.message}`);
        }
      } catch (error) {
        console.error('Error moving file:', error);
        alert('Failed to move file. Check console for details.');
      } finally {
        hideLoading();
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
        showLoading('Copying file...');
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
          loadFileTree();
          showCopyDialog.value = false;
          destinationPath.value = '';
        } else {
          alert(`Failed to copy file: ${data.message}`);
        }
      } catch (error) {
        console.error('Error copying file:', error);
        alert('Failed to copy file. Check console for details.');
      } finally {
        hideLoading();
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
        showLoading('Creating file...');
        const response = await fetch(`${API_URL}/file/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'workspace-id': workspaceId.value
          },
          body: JSON.stringify({
            filePath: newFilePath.value,
            content: ''
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          showNewFileDialog.value = false;
          loadFileTree();
          openFile(newFilePath.value);
        } else {
          alert(`Failed to create file: ${data.message}`);
        }
      } catch (error) {
        console.error('Error creating file:', error);
        alert('Failed to create file. Check console for details.');
      } finally {
        hideLoading();
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
      
      // Auto-fill uploadPath with the filename if not provided
      if (file && !uploadPath.value) {
        uploadPath.value = file.name;
      }
    };
    
    const confirmUpload = async () => {
      if (!uploadPath.value.trim() || !selectedFileToUpload.value) {
        alert('Please select a file and enter a destination path');
        return;
      }
      
      try {
        showLoading('Uploading file...');
        const workspaceId = localStorage.getItem('workspaceId');
        
        const reader = new FileReader();
        reader.onload = async (e) => {
          const content = e.target.result;
          
          await fetch(`${API_URL}/file/upload`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'workspace-id': workspaceId
            },
            body: JSON.stringify({
              path: uploadPath.value,
              content
            })
          });
          
          showUploadDialog.value = false;
          loadFileTree();
          hideLoading();
        };
        
        reader.readAsText(selectedFileToUpload.value);
      } catch (error) {
        console.error('Error uploading file:', error);
        alert('Failed to upload file. Check console for details.');
        hideLoading();
      }
    };
    
    const handleUploadFile = () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      
      fileInput.onchange = async (event) => {
        const file = event.target.files[0];
        if (file) {
          try {
            showLoading('Uploading file...');
            
            const reader = new FileReader();
            reader.onload = async (e) => {
              const content = e.target.result;
              
              const currentDir = currentFile.value 
                ? currentFile.value.substring(0, currentFile.value.lastIndexOf('/')) 
                : '';
              
              const uploadPath = currentDir 
                ? `${currentDir}/${file.name}` 
                : file.name;
              
              await fetch(`${API_URL}/file/upload`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'workspace-id': workspaceId.value
                },
                body: JSON.stringify({
                  path: uploadPath,
                  content: content
                })
              });
              
              await loadFileTree();
              openFile(uploadPath);
            };
            reader.readAsText(file);
          } catch (error) {
            console.error('Error uploading file:', error);
          } finally {
            hideLoading();
          }
        }
      };
      
      fileInput.click();
    };

    // Generate preview
    const generatePreview = async () => {
      try {
        showLoading('Generating preview...');
        
        const response = await fetch(`${API_URL}/preview/build`, {
          method: 'POST',
          headers: {
            'workspace-id': workspaceId.value
          }
        });
        
        const data = await response.json();
        
        if (data.success) {
          loadPreviewFiles();
        } else {
          alert(`Failed to generate preview: ${data.message}`);
        }
      } catch (error) {
        console.error('Error generating preview:', error);
        alert('Failed to generate preview. Check console for details.');
      } finally {
        hideLoading();
      }
    };

    // Load available preview files
    const loadPreviewFiles = async () => {
      try {
        const response = await fetch(`${API_URL}/preview/list`, {
          headers: {
            'workspace-id': workspaceId.value
          }
        });
        
        const data = await response.json();
        
        if (data.success) {
          previewFiles.value = data.previewFiles;
          
          if (previewFiles.value.length > 0) {
            selectedPreview.value = previewFiles.value[0].name;
            loadPreview();
          }
        } else {
          console.error('Failed to load preview files:', data.message);
        }
      } catch (error) {
        console.error('Error loading preview files:', error);
      }
    };

    // Load selected preview content
    const loadPreview = async () => {
      if (!selectedPreview.value) return;
      
      try {
        showLoading('Loading preview...');
        const response = await fetch(`${API_URL}/preview/content/${encodeURIComponent(selectedPreview.value)}`, {
          headers: {
            'workspace-id': workspaceId.value
          }
        });
        
        const data = await response.json();
        
        if (data.success) {
          previewContent.value = data.content;
        } else {
          console.error('Failed to load preview content:', data.message);
          previewContent.value = '';
        }
      } catch (error) {
        console.error('Error loading preview content:', error);
        previewContent.value = '';
      } finally {
        hideLoading();
      }
    };

    // Panel resize handlers
    const startResizeLeft = (e) => {
      isResizingLeft.value = true;
      document.addEventListener('mousemove', handleMouseMoveLeft);
      document.addEventListener('mouseup', stopResize);
      e.preventDefault();
    };
    
    const startResizeMiddle = (e) => {
      isResizingMiddle.value = true;
      document.addEventListener('mousemove', handleMouseMoveMiddle);
      document.addEventListener('mouseup', stopResize);
      e.preventDefault();
    };
    
    const handleMouseMoveLeft = (e) => {
      if (!isResizingLeft.value) return;
      
      const newWidth = Math.max(150, Math.min(500, e.clientX));
      leftPanelWidth.value = newWidth;
    };
    
    const handleMouseMoveMiddle = (e) => {
      if (!isResizingMiddle.value) return;
      
      const totalWidth = window.innerWidth - leftPanelWidth.value;
      const minRightWidth = 200;
      
      const maxMiddleWidth = totalWidth - minRightWidth;
      const newWidth = Math.max(200, Math.min(maxMiddleWidth, e.clientX - leftPanelWidth.value));
      middlePanelWidth.value = newWidth;
    };
    
    const stopResize = () => {
      isResizingLeft.value = false;
      isResizingMiddle.value = false;
      document.removeEventListener('mousemove', handleMouseMoveLeft);
      document.removeEventListener('mousemove', handleMouseMoveMiddle);
      document.removeEventListener('mouseup', stopResize);
    };

    onMounted(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const urlWorkspaceId = urlParams.get('workspace');
      
      if (urlWorkspaceId) {
        workspaceId.value = urlWorkspaceId;
        localStorage.setItem('workspaceId', urlWorkspaceId);
      }
      
      if (workspaceId.value) {
        loadFileTree();
        loadPreviewFiles();
      }
      
      window.addEventListener('resize', handleWindowResize);
    });
    
    onUnmounted(() => {
      document.removeEventListener('mousemove', handleMouseMoveLeft);
      document.removeEventListener('mousemove', handleMouseMoveMiddle);
      document.removeEventListener('mouseup', stopResize);
      window.removeEventListener('resize', handleWindowResize);
    });
    
    const handleWindowResize = () => {
      const totalWidth = window.innerWidth;
      
      const maxLeftWidth = totalWidth * 0.4;
      if (leftPanelWidth.value > maxLeftWidth) {
        leftPanelWidth.value = maxLeftWidth;
      }
      
      const maxMiddleWidth = (totalWidth - leftPanelWidth.value) * 0.7;
      if (middlePanelWidth.value > maxMiddleWidth) {
        middlePanelWidth.value = maxMiddleWidth;
      }
    };

    return {
      workspaceId,
      isCreatingWorkspace,
      isGeneratingPreview,
      createWorkspace,
      closeWorkspace,
      copyWorkspaceUrl,
      
      // File tree
      files,
      loadingFiles,
      fileTreeError,
      expandedDirs,
      sortedFiles,
      handleFileClick,
      getFileIcon,
      loadFileTree,
      
      // Current file
      currentFile,
      fileContent,
      openFile,
      saveFile,
      
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
      confirmUpload,
      handleUploadFile,
      
      // Preview
      previewFiles,
      selectedPreview,
      previewContent,
      generatePreview,
      loadPreview,
      
      // Layout
      leftPanelWidth,
      middlePanelWidth,
      startResizeLeft,
      startResizeMiddle,

      // Loading
      isLoading,
      loadingMessage,
      showLoading,
      hideLoading
    };
  }
};
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: Arial, sans-serif;
  line-height: 1.6;
}

.app-container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Workspace creation screen */
.workspace-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.workspace-controls h1 {
  margin-bottom: 2rem;
}

/* Main editor layout */
.editor-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background-color: #f4f4f4;
  border-bottom: 1px solid #ddd;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

/* Three-column layout */
.columns-container {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.column {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Left column - File Tree */
.file-tree {
  flex-grow: 1;
  background-color: #f8f8f8;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-basis: 20%;
}

.file-tree-header {
  padding: 0.75em;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
}

.file-list {
  flex-grow: 1;
  overflow-y: auto;
  padding: 0.75em;
}

.file-tree-directory {
  width: 100%;
}

/* Directory controls */
.directory-controls {
  display: flex;
  margin-top: 0.5rem;
  gap: 0.3rem;
}

/* File entries */
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

/* Middle column - Code Editor */
.code-editor {
  flex-grow: 1;
  flex-basis: 40%;
  overflow: hidden;
}

/* Right column - Preview Pane */
.preview-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  flex-basis: 40%;
  overflow: hidden;
}

.preview-pane > *:last-child {
  flex-grow: 1;
  overflow: auto;
}

/* Resize handle styling */
.resize-handle {
  width: 6px;
  background-color: #e0e0e0;
  cursor: col-resize;
  transition: background-color 0.2s;
  flex: 0 0 auto;
}

.resize-handle:hover, 
.resize-handle:active {
  background-color: #007bff;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background-color: #f5f5f5;
  border-bottom: 1px solid #ddd;
}

.preview-header h3 {
  margin: 0;
  font-size: 1rem;
  padding: 0;
  border: 0;
}

.preview-selector {
  flex-shrink: 0;
}

.no-preview {
  margin: 2rem 0;
  color: #777;
  text-align: center;
}

h3 {
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

button {
  padding: 0.5rem 1rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #0069d9;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

button.danger {
  background-color: #dc3545;
}

button.danger:hover {
  background-color: #c82333;
}

button.copy-url {
  background-color: #6c757d;
}

button.copy-url:hover {
  background-color: #5a6268;
}

.small-button {
  font-size: 0.8rem;
  padding: 0.25rem 0.5rem;
  margin-right: 0.5rem;
}

select {
  padding: 0.5rem;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.no-file-selected {
  margin: 2rem 0;
  color: #777;
  text-align: center;
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
  color: #333;
}

.menu-item:hover {
  background-color: #f5f5f5;
}

/* Modal dialog for operations */
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
}

.secondary-button:hover {
  background-color: #5a6268;
}

.primary-button {
  background-color: #007bff;
}

.primary-button:hover {
  background-color: #0069d9;
}

/* Loading overlay styles */
.loading-notification {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  background-color: rgba(0, 0, 0, 0.8);
  padding: 1rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  z-index: 1000;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text {
  color: white;
  font-size: 0.9rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
