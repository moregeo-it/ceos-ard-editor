<template>
  <div class="app-container">
    <!-- Loading state while checking authentication -->
    <div v-if="isAuthLoading" class="auth-loading">
      <div class="loading-spinner"></div>
      <div class="loading-text">Checking authentication...</div>
    </div>
    
    <!-- Show login page if user is not authenticated and not still loading -->
    <login-page v-else-if="!isAuthenticated" />

    <!-- Only show editor UI if authenticated -->
    <template v-else>
      <!-- Loading overlay for async operations -->
      <div v-if="isLoading" class="loading-notification">
        <div class="loading-spinner"></div>
        <div class="loading-text">{{ loadingMessage }}</div>
      </div>

      <!-- Modal components -->
      <alert-modal ref="alertModal" :title="modalTitle" :message="modalMessage" />
      <confirm-modal ref="confirmModal" :title="modalTitle" :message="modalMessage" :confirm-text="modalConfirmText" />
      <propose-changes-modal ref="proposeChangesModal" @loading="showLoading" @done="hideLoading" />

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
            <button @click="proposeChanges" class="propose">Propose Changes</button>
            <button @click="closeWorkspace" class="danger">Close Workspace</button>
          </div>
          <div class="user-info" v-if="user">
            <img v-if="user.avatar" :src="user.avatar" alt="User avatar" class="user-avatar" />
            <span class="username">{{ user.username }}</span>
            <button @click="logout" class="logout-btn">Logout</button>
          </div>
        </div>

        <!-- Three-column layout -->
        <div class="columns-container">
          <!-- Left column: File tree -->
          <div class="column file-tree" :style="{ 'flex-basis': panelWidth[0] + '%' }">
            <div class="file-tree-header">
              <h3>Files</h3>
            </div>
            <div class="file-list">
              <file-tree-directory 
                path="" 
                :currentOpenFile="currentFile"
                @select-file="openFile" 
                @refresh="loadFileTree" 
                @update-current-file="handleFilePathUpdate"
                @file-operation-loading="showLoading"
                @file-operation-complete="hideLoading"
              />
            </div>
          </div>
          
          <!-- Resize handle for left panel -->
          <div 
            class="resize-handle"
            @mousedown="(e) => startResize(0, e)"
          ></div>

          <!-- Middle column: Code editor -->
          <div class="column code-editor" :style="{ 'flex-basis': panelWidth[1] + '%' }">
            <code-editor 
              v-if="currentFile && isFileEditable"
              v-model="fileContent"
              :filename="currentFile"
              @save="saveFile"
            />
            <file-viewer 
              v-else-if="currentFile && !isFileEditable"
              :filename="currentFile"
              :content="fileContent"
            />
            <div v-else class="no-file-selected">
              Select a file to edit
            </div>
          </div>
          
          <!-- Resize handle for middle panel -->
          <div 
            class="resize-handle"
            @mousedown="(e) => startResize(1, e)"
          ></div>

          <!-- Right column: Preview -->
          <div class="column preview-pane" :style="{ 'flex-basis': panelWidth[2] + '%' }">
            <div class="preview-header">
              <h3>Preview</h3>
              <div class="preview-selector">
                <button @click="generateAllPreviews" title="Regenerate all">⟳</button>
                &nbsp;
                <select v-if="previewFiles.length > 0" v-model="selectedPreview" @change="loadPreview">
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
              v-if="selectedPreview"
              :content="previewContent"
              :selected-preview-name="selectedPreview"
              :is-resizing="resizeState && resizeState.active"
              @build-completed="handleBuildCompleted"
              @open-file="openFile"
              ref="previewPaneRef"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, provide } from 'vue';
import FileTreeDirectory from './components/FileTreeDirectory.vue';
import CodeEditor from './components/CodeEditor.vue';
import PreviewPane from './components/PreviewPane.vue';
import FileViewer from './components/FileViewer.vue';
import AlertModal from './components/AlertModal.vue';
import ConfirmModal from './components/ConfirmModal.vue';
import ProposeChangesModal from './components/ProposeChangesModal.vue';
import LoginPage from './components/LoginPage.vue';
import { API_URL } from './config.js';
import { AuthService } from './services/auth';
import api from './services/auth';

export default {
  name: 'App',
  components: {
    FileTreeDirectory,
    CodeEditor,
    PreviewPane,
    FileViewer,
    AlertModal,
    ConfirmModal,
    ProposeChangesModal,
    LoginPage
  },
  setup() {
    // Authentication state
    const isAuthenticated = ref(false);
    const user = ref(null);
    const isAuthLoading = ref(true);
    
    // Check authentication status
    const checkAuth = async () => {
      isAuthLoading.value = true;
      const currentUser = await AuthService.getCurrentUser();
      isAuthenticated.value = !!currentUser;
      user.value = currentUser;
      isAuthLoading.value = false;
      
      // If user is authenticated, proceed with workspace loading
      if (isAuthenticated.value) {
        loadWorkspaceFromUrlOrStorage();
      }
    };
    
    // Load workspace from URL or localStorage
    const loadWorkspaceFromUrlOrStorage = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const urlWorkspaceId = urlParams.get('workspace');
      
      if (urlWorkspaceId) {
        workspaceId.value = urlWorkspaceId;
        localStorage.setItem('workspaceId', urlWorkspaceId);
      }
      
      if (workspaceId.value) {
        loadFileTree();
        generateAllPreviews().then(() => {
          setTimeout(() => {
            loadPreviewFiles();
          }, 1000);
        });
      }
    };
    
    // Logout function
    const logout = async () => {
      await AuthService.logout();
      isAuthenticated.value = false;
      user.value = null;
      
      // Clear workspace data
      workspaceId.value = '';
      localStorage.removeItem('workspaceId');
    };

    // Workspace state
    const workspaceId = ref(localStorage.getItem('workspaceId') || '');
    const isCreatingWorkspace = ref(false);

    // File browser state
    const files = ref([]);
    const loadingFiles = ref(true);
    const fileTreeError = ref(false);
    const currentFile = ref('');
    const fileContent = ref('');
    const isFileEditable = ref(true);
    const changedFiles = ref({}); // Track changed files by path

    // Preview state
    const previewFiles = ref([]);
    const selectedPreview = ref('');
    const previewContent = ref('');
    const previewPaneRef = ref(null);
    
    // Modal components
    const alertModal = ref(null);
    const confirmModal = ref(null);
    const proposeChangesModal = ref(null);
    const modalTitle = ref('');
    const modalMessage = ref('');
    const modalConfirmText = ref('Confirm');

    // Helper functions for modal usage
    const showAlert = (message, title = 'Alert') => {
      modalTitle.value = title;
      modalMessage.value = message;
      return alertModal.value.show();
    };

    const showConfirm = (message, title = 'Confirm', confirmText = 'Confirm') => {
      modalTitle.value = title;
      modalMessage.value = message;
      modalConfirmText.value = confirmText;
      return confirmModal.value.show();
    };

    // Propose changes function
    const proposeChanges = async () => {
      return proposeChangesModal.value.show();
    };

    // Provide modal functions to child components
    provide('showAlert', showAlert);
    provide('showConfirm', showConfirm);
    
    // Panel resize state
    const panelWidth = ref([20,40,40]);
    const resizeState = ref({
      active: false,
      panel: null,
      startX: 0,
      startWidth: panelWidth.value.slice(0)
    });

    // Reusable resize handlers
    const startResize = (panel, e) => {
      // Store starting position and current width
      resizeState.value = {
        active: true,
        panel,
        startX: e.clientX,
        startWidth: panelWidth.value.slice(0)
      };
      
      // Add visual indicator to the resize handle
      e.target.classList.add('resizing');
      
      // Add global event listeners
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', stopResize);
      
      // Prevent default browser behavior that might interfere
      e.preventDefault();
    };
    
    const handleMouseMove = (e) => {
      if (!resizeState.value.active) return;

      const { panel, startWidth, startX } = resizeState.value;
      const base = 100 / window.innerWidth;
      const movementX = base * (e.clientX - startX);
      const [l, r, o] = [panel, panel+1, (panel+2)%3];

      panelWidth.value[l] = Math.max(0, startWidth[l] + movementX);
      panelWidth.value[r] = Math.max(0, startWidth[r] - movementX);
      panelWidth.value[o] = Math.max(0, 100 - (panelWidth.value[l] + panelWidth.value[r]));
    };
    
    const stopResize = () => {
      // Reset resize state
      resizeState.value.active = false;
      
      // Remove visual indicator from all resize handles
      document.querySelectorAll('.resize-handle').forEach(el => {
        el.classList.remove('resizing');
      });
      
      // Remove global event listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopResize);
    };

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
        const response = await api.post('/workspace/create');
        
        const data = response.data;
        
        if (data.success) {
          workspaceId.value = data.workspaceId;
          localStorage.setItem('workspaceId', data.workspaceId);
          
          // Update URL with workspace ID for sharing
          const url = new URL(window.location.href);
          url.searchParams.set('workspace', data.workspaceId);
          window.history.replaceState({}, '', url);
          
          loadFileTree();
        } else {
          showAlert(`Failed to create workspace: ${data.message}`, 'Error');
        }
      } catch (error) {
        console.error('Error creating workspace:', error);
        showAlert('Failed to create workspace. Check console for details.', 'Error');
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
          showAlert('Workspace URL copied to clipboard!', 'Success');
        })
        .catch(err => {
          console.error('Could not copy URL: ', err);
          showAlert('Failed to copy URL. You can manually share this URL.', 'Error');
        });
    };

    // Close and delete the workspace
    const closeWorkspace = async () => {
      const confirmed = await showConfirm(
        'Are you sure you want to close this workspace? All changes will be lost if the changes were not proposed yet.',
        'Close Workspace',
        'Close'
      );
      
      if (!confirmed) {
        return;
      }
      
      try {
        const response = await api.delete(`/workspace/${workspaceId.value}`, {
          headers: {
            'workspace-id': workspaceId.value
          }
        });
        
        const data = response.data;
        
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
          showAlert(`Failed to close workspace: ${data.message}`, 'Error');
        }
      } catch (error) {
        console.error('Error closing workspace:', error);
        showAlert('Failed to close workspace. Check console for details.', 'Error');
      }
    };

    // Load file tree
    const loadFileTree = async () => {
      loadingFiles.value = true;
      fileTreeError.value = false;
      
      try {
        const response = await api.get('/file/list', {
          headers: {
            'workspace-id': workspaceId.value
          }
        });
        
        const data = response.data;
        
        if (data.success) {
          files.value = data.files;
        } else {
          fileTreeError.value = true;
          showAlert(`Failed to load file tree: ${data.message}`, 'Error');
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
        const response = await api.get(`/file/content?filePath=${encodeURIComponent(filePath)}`, {
          headers: {
            'workspace-id': workspaceId.value
          }
        });
        
        const data = response.data;
        
        if (data.success) {
          currentFile.value = filePath;
          fileContent.value = data.content;
          isFileEditable.value = data.isEditable;
        } else {
          showAlert(`Failed to open file: ${data.message}`, 'Error');
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
        const response = await api.post('/file/save', {
          filePath: currentFile.value,
          content: fileContent.value
        }, {
          headers: {
            'Content-Type': 'application/json',
            'workspace-id': workspaceId.value
          }
        });
        
        const data = response.data;
        
        if (data.success) {
          // Clear the changedFiles cache to ensure fresh data on next load
          changedFiles.value = {};
          
          // Reload the entire file tree to update file statuses
          await loadFileTree();
          
          // Rebuild only the current preview if one is selected
          if (selectedPreview.value && previewPaneRef.value) {
            previewPaneRef.value.generatePreview(selectedPreview.value);
          } else {
            // If no preview is selected yet, generate all previews
            await generateAllPreviews();
          }
        } else {
          showAlert(`Failed to save file: ${data.message}`, 'Error');
        }
      } catch (error) {
        console.error('Error saving file:', error);
        showAlert('Failed to save file. Check console for details.', 'Error');
      } finally {
        hideLoading();
      }
    };

    // Generate preview
    const generatePreview = async () => {
      try {
        showLoading('Generating preview...');
        
        const response = await api.post('/preview/build', {}, {
          params: {
            pfs: selectedPreview.value
          },
          headers: {
            'workspace-id': workspaceId.value
          }
        });
        
        const data = response.data;
        
        if (data.success) {
          loadPreviewFiles();
        } else {
          showAlert(`Failed to generate preview: ${data.message}`, 'Error');
        }
      } catch (error) {
        console.error('Error generating preview:', error);
        showAlert('Failed to generate preview. Check console for details.', 'Error');
      } finally {
        hideLoading();
      }
    };

    // Generate all previews (initial load)
    const generateAllPreviews = async () => {
      try {
        showLoading('Generating all previews...');
        
        // Use the unified build endpoint without a pfs parameter to build all files
        const response = await api.post('/preview/build', {}, {
          headers: {
            'Content-Type': 'application/json',
            'Workspace-Id': workspaceId.value
          }
        });
        
        const data = response.data;
        
        if (data.success) {
          // Start polling for build status
          pollBuildStatus();
        } else {
          showAlert(`Failed to generate previews: ${data.message}`, 'Error');
          hideLoading();
        }
      } catch (error) {
        console.error('Error generating previews:', error);
        showAlert('Failed to generate previews. Check console for details.', 'Error');
        hideLoading();
      }
    };
    
    // Poll for build status when generating all previews
    let buildStatusPollInterval = null;
    const pollBuildStatus = async () => {
      // Clear any existing interval
      if (buildStatusPollInterval) {
        clearInterval(buildStatusPollInterval);
      }
      
      const pollingStartTime = Date.now();
      const POLLING_TIMEOUT = 5 * 60 * 1000; // 5 minutes timeout
      
      // Set up polling interval (every 2 seconds)
      buildStatusPollInterval = setInterval(async () => {
        try {
          // Check if we've exceeded the timeout
          if (Date.now() - pollingStartTime > POLLING_TIMEOUT) {
            clearInterval(buildStatusPollInterval);
            buildStatusPollInterval = null;
            hideLoading();
            console.warn('Build status polling timed out');
            return;
          }
          
          const response = await api.get('/preview/build-status', {
            headers: {
              'Workspace-Id': workspaceId.value
            }
          });
          
          // Process the response data
          const data = response.data;
          
          loadingMessage.value = getBuildStatusMessage(data.status, data.error);
          
          // Check if the build has completed or failed
          if (data.status === 'completed') {
            clearInterval(buildStatusPollInterval);
            buildStatusPollInterval = null;
            hideLoading();
            loadPreviewFiles();
          } else if (data.status === 'failed') {
            clearInterval(buildStatusPollInterval);
            buildStatusPollInterval = null;
            hideLoading();
            showAlert(`Build failed: ${data.error || 'Unknown error'}`, 'Build Failed');
          }
          
        } catch (error) {
          // Handle different types of errors
          if (error.response) {
            // The request was made and the server responded with a status code outside of 2xx
            if (error.response.status === 404) {
              // If the workspace doesn't have a build in progress
              clearInterval(buildStatusPollInterval);
              buildStatusPollInterval = null;
              hideLoading();
              loadPreviewFiles(); // Still try to load previews that might be there
              return;
            }
            console.error('Error response from build status API:', error.response.data);
          } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received for build status check:', error.request);
          } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error polling build status:', error.message);
          }
          
          // Don't flood the console with errors if polling continues
          if (buildStatusPollInterval) {
            // Only log once per minute to avoid console spam
            if (Math.floor((Date.now() - pollingStartTime) / 60000) % 1 === 0) {
              console.warn('Continuing to poll despite errors...');
            }
          }
        }
      }, 2000);
    };
    
    // Get status message based on build status
    const getBuildStatusMessage = (status, error) => {
      switch (status) {
        case 'starting':
          return 'Preparing build environment...';
        case 'in_progress':
          return 'Building documents...';
        case 'completed':
          return 'Build completed successfully!';
        case 'failed':
          return `Build failed: ${error || 'Unknown error'}`;
        default:
          return `Build status: ${status}`;
      }
    };

    // Load available preview files
    const loadPreviewFiles = async () => {
      try {
        // Remember the currently selected preview before reloading
        const currentSelectedPreview = selectedPreview.value;
        
        const response = await api.get('/preview/list', {
          headers: {
            'workspace-id': workspaceId.value
          }
        });
        
        const data = response.data;
        
        if (data.success) {
          previewFiles.value = data.previewFiles;
          
          if (previewFiles.value.length > 0) {
            // If there was a previously selected preview and it's still in the list, keep it selected
            if (currentSelectedPreview && 
                previewFiles.value.some(file => file.name === currentSelectedPreview)) {
              selectedPreview.value = currentSelectedPreview;
            } else {
              // Otherwise select the first one
              selectedPreview.value = previewFiles.value[0].name;
            }
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
        const response = await api.get(`/preview/content/${encodeURIComponent(selectedPreview.value)}`, {
          headers: {
            'workspace-id': workspaceId.value
          }
        });
        
        const data = response.data;
        
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

    const handleBuildCompleted = () => {
      loadPreviewFiles();
    };
    
    // Handle file path updates from file operations
    const handleFilePathUpdate = ({ oldPath, newPath }) => {
      // If the file is currently open, update the path
      if (currentFile.value === oldPath) {
        currentFile.value = newPath;
        
        // If the file is being deleted (newPath is empty), also clear content
        if (!newPath) {
          fileContent.value = '';
          isFileEditable.value = true;
        }
      }
    };

    onMounted(async () => {
      // First check if user is authenticated
      await checkAuth();
      
      // The rest of the setup will happen in checkAuth if the user is authenticated
    });
    
    onUnmounted(() => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopResize);
    });

    provide('changedFiles', changedFiles);

    return {
      // Auth state
      isAuthenticated,
      isAuthLoading,
      user,
      logout,
      
      // Workspace state
      workspaceId,
      isCreatingWorkspace,
      createWorkspace,
      closeWorkspace,
      copyWorkspaceUrl,
      
      // File tree
      files,
      loadingFiles,
      fileTreeError,
      loadFileTree,
      
      // Current file
      currentFile,
      fileContent,
      isFileEditable,
      openFile,
      saveFile,
      
      // Preview
      previewFiles,
      selectedPreview,
      previewContent,
      generatePreview,
      generateAllPreviews,
      loadPreview,
      handleBuildCompleted,
      
      // Layout
      panelWidth,
      startResize,
      resizeState,
      previewPaneRef,

      // Loading
      isLoading,
      loadingMessage,
      showLoading,
      hideLoading,
      
      // File path update handler for operations done in FileTreeDirectory
      handleFilePathUpdate,
      
      // Modal system
      alertModal,
      confirmModal,
      proposeChangesModal,
      modalTitle,
      modalMessage,
      modalConfirmText,
      showAlert,
      showConfirm,
      proposeChanges
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

/* User info in toolbar */
.user-info {
  display: flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background-color: #f0f0f0;
}

.user-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  margin-right: 0.5rem;
}

.username {
  font-size: 0.9rem;
  margin-right: 0.5rem;
}

.logout-btn {
  background-color: #f8f8f8;
  color: #333;
  border: 1px solid #ddd;
  padding: 0.2rem 0.5rem;
  font-size: 0.8rem;
}

.logout-btn:hover {
  background-color: #e9e9e9;
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
  align-items: center;
  font-size: 0.9rem;
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
  background-color: #f8f8f8;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.file-tree-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
  min-height: 3.5rem;
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

.file-entry.is-changed {
  background-color: #fff3cd;
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

.change-indicator {
  color: #d73a49;
  font-weight: bold;
  margin-right: 0.5rem;
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
  overflow: hidden;
}

/* Right column - Preview Pane */
.preview-pane {
  display: flex;
  flex-direction: column;
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
  position: relative;
  z-index: 10; /* Ensure it's above other elements */
}

/* Create a wider clickable area */
.resize-handle::after {
  content: "";
  position: absolute;
  top: 0;
  left: -5px; /* Extend 5px to the left */
  width: 16px; /* Total width 16px (extends 5px left + 6px handle + 5px right) */
  height: 100%;
  cursor: col-resize;
  z-index: 5;
}

.resize-handle:hover {
  background-color: #007bff;
}

.resize-handle.resizing {
  background-color: #0056b3;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background-color: #f5f5f5;
  border-bottom: 1px solid #ddd;
}

.preview-header h3, .file-tree-header h3 {
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

button.propose {
  background-color: #28a745;
}

button.propose:hover {
  background-color: #218838;
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

/* Modal styles */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1001;
}

.modal-content {
  background-color: white;
  padding: 2rem;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.form-group textarea {
  resize: none;
}

.helper-text {
  font-size: 0.8rem;
  color: #777;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
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

/* Proposal result styles */
.proposal-result {
  text-align: center;
}

.success-message {
  color: #28a745;
}

.success-icon {
  font-size: 2rem;
}

.pull-request-info {
  margin-top: 1rem;
}

.pr-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pr-url {
  color: #007bff;
  text-decoration: none;
}

.pr-url:hover {
  text-decoration: underline;
}

.icon-button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
}

.icon-button:hover {
  color: #0056b3;
}

.error-message {
  color: #dc3545;
}

.error-icon {
  font-size: 2rem;
}

.instructions {
  text-align: left;
  margin-top: 1rem;
}

/* Authentication loading styles */
.auth-loading {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  gap: 1rem;
}
</style>
