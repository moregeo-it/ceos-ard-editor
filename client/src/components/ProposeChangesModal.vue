<template>
  <Modal v-model="isOpen" title="Propose Changes" :isLarge="true" width="85%" height="85%">
    <div class="modal-body">
      <!-- Step 1: View file changes -->
      <div v-if="currentStep === 1" class="modal-inner diff-container">
        <div v-if="isLoadingChanges" class="loading-changes">
          <div class="loading-spinner"></div>
          <p>Loading changes...</p>
        </div>
        <div v-else-if="!hasChanges" class="no-changes">
          <p>There are no changes to propose. Make some changes to files first.</p>
        </div>
        <div v-else>
          <h4>Changed Files</h4>
          <div class="changed-files-list">
            <div v-for="file in changedFiles" :key="file.path" class="changed-file">
              <div class="file-header" @click="toggleFileDiff(file.path)">
                <span class="file-status" :class="getStatusClass(file.status)">{{ file.status }}</span>
                <span class="file-name">{{ file.path }}</span>
                <span class="toggle-icon">{{ expandedFiles[file.path] ? '▼' : '▶' }}</span>
              </div>
              <div v-if="expandedFiles[file.path]" class="file-diff">
                <!-- Special message for new or deleted files -->
                <div v-if="file.status === 'Added'" class="diff-message new-file-message">
                  <span class="diff-icon">+</span>New file: {{ file.path }}
                </div>
                <div v-else-if="file.status === 'Deleted'" class="diff-message deleted-file-message">
                  <span class="diff-icon">-</span>File deleted: {{ file.path }}
                </div>
                <!-- For modified files, use diff2html to visualize the diff -->
                <div v-else-if="file.diffLoaded" class="diff2html-container" v-html="file.formattedDiff"></div>
                <div v-else class="loading-diff">
                  <div class="loading-spinner small"></div>
                  <span>Loading diff...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 2: Form for submitting PR info -->
      <div v-else-if="currentStep === 2" class="modal-inner">
        <div class="form-group">
          <label class="form-label">Title (short summary):</label>
          <input 
            type="text" 
            v-model="proposeChangesTitle" 
            class="form-control"
            placeholder="Brief summary of your changes"
            ref="proposeTitleInput"
            @keyup.enter="submitProposal"
          />
        </div>
        <div class="form-group">
          <label class="form-label">Description:</label>
          <textarea 
            v-model="proposeChangesDescription" 
            class="form-control"
            placeholder="Detailed description of what you changed and why"
            rows="5"
          ></textarea>
        </div>
      </div>
      
      <!-- Success message after submission -->
      <div v-else-if="proposalSubmitted" class="modal-inner proposal-result">
        <div v-if="proposalSuccess" class="success-message">
          <div class="success-icon">✅</div>
          <h3>Changes Proposed Successfully!</h3>
          <p>Branch: <strong>{{ proposalBranchName }}</strong></p>
          
          <div v-if="pullRequestUrl" class="pull-request-info">
            <h4>Pull Request Created:</h4>
            <div class="pr-link">
              <a :href="pullRequestUrl" target="_blank" class="pr-url">{{ pullRequestUrl }}</a>
            </div>
          </div>
          
          <div v-else-if="!automaticPr" class="instructions">
            <h4>Next Steps:</h4>
            <pre>{{ proposalInstructions }}</pre>
          </div>
        </div>
        <div v-else class="error-message">
          <div class="error-icon">❌</div>
          <h3>Failed to Propose Changes</h3>
          <p>{{ proposalErrorMessage }}</p>
        </div>
      </div>
    </div>
    
    <template #footer>
      <div class="d-flex justify-content-end gap-2">
        <template v-if="currentStep === 1">
          <base-button variant="secondary" @click="cancel">Cancel</base-button>
          <base-button 
            variant="success" 
            @click="goToNextStep" 
            :disabled="!hasChanges"
          >
            Next
          </base-button>
        </template>
        <template v-else-if="currentStep === 2">
          <base-button variant="secondary" @click="goToPreviousStep">Back</base-button>
          <base-button 
            variant="success" 
            @click="submitProposal" 
            :disabled="!proposeChangesTitle.trim()"
          >
            Submit
          </base-button>
        </template>
        <template v-else>
          <base-button variant="primary" @click="close">Close</base-button>
        </template>
      </div>
    </template>
  </Modal>
</template>

<script>
import Modal from './Modal.vue';
import BaseButton from './BaseButton.vue';
import { ref, nextTick } from 'vue';
import { html, parse } from 'diff2html';
import 'diff2html/bundles/css/diff2html.min.css';
import api from '../services/auth.js';

export default {
  name: 'ProposeChangesModal',
  components: { Modal, BaseButton },
  emits: ['loading', 'done'],
  setup(props, { emit }) {
    // Modal state
    const isOpen = ref(false);
    const currentStep = ref(1);
    
    // Get current workspace ID from parent component
    const workspaceId = ref('');
    
    // Changes data
    const changedFiles = ref([]);
    const isLoadingChanges = ref(false);
    const hasChanges = ref(false);
    const expandedFiles = ref({});
    
    // Form data
    const proposeChangesTitle = ref('');
    const proposeChangesDescription = ref('');
    
    // Result state
    const proposalSubmitted = ref(false);
    const proposalSuccess = ref(false);
    const proposalBranchName = ref('');
    const proposalInstructions = ref('');
    const proposalErrorMessage = ref('');
    const pullRequestUrl = ref('');
    const automaticPr = ref(false);
    
    // Promise resolution for async operation
    let resolvePromise = null;

    const show = () => {
      // Get the current workspace ID from local storage
      workspaceId.value = localStorage.getItem('workspaceId') || '';
      
      if (!workspaceId.value) {
        console.error('No workspace ID found');
        return Promise.resolve({ canceled: true });
      }

      // Reset all state
      currentStep.value = 1;
      changedFiles.value = [];
      isLoadingChanges.value = true;
      hasChanges.value = false;
      expandedFiles.value = {};
      proposeChangesTitle.value = '';
      proposeChangesDescription.value = '';
      proposalSubmitted.value = false;
      proposalSuccess.value = false;
      proposalBranchName.value = '';
      proposalInstructions.value = '';
      proposalErrorMessage.value = '';
      pullRequestUrl.value = '';
      automaticPr.value = false;
      
      // Show the modal
      isOpen.value = true;
      
      // Load the changes
      loadChanges();
      
      // Return a promise that resolves when the operation is complete
      return new Promise(resolve => {
        resolvePromise = resolve;
      });
    };

    const loadChanges = async () => {
      isLoadingChanges.value = true;
      hasChanges.value = false;
      
      try {
        if (!workspaceId.value) {
          throw new Error('No workspace ID found');
        }
        
        // Get git status using authenticated API
        const response = await api.get(`/workspace/${workspaceId.value}/status`, {
          headers: {
            'workspace-id': workspaceId.value
          }
        });
        
        const data = response.data;
        
        if (data.success && data.files) {
          // Check if there are any changes
          hasChanges.value = data.files.length > 0;
          
          // Format changed files for display
          changedFiles.value = data.files.map(file => {
            // Convert status to display format (first letter capitalized)
            const displayStatus = file.status.charAt(0).toUpperCase() + file.status.slice(1);
            
            return {
              path: file.path,
              status: displayStatus,
              originalPath: file.originalPath, // For renamed files
              diff: null,
              diffLoaded: false,
              formattedDiff: null
            };
          });
        } else {
          hasChanges.value = false;
        }
      } catch (error) {
        console.error('Error loading changes:', error);
        hasChanges.value = false;
      } finally {
        isLoadingChanges.value = false;
      }
    };
    
    const toggleFileDiff = async (filePath) => {
      // Toggle expanded state
      expandedFiles.value[filePath] = !expandedFiles.value[filePath];
      
      // If expanding and no diff loaded yet, load it
      if (expandedFiles.value[filePath]) {
        const fileIndex = changedFiles.value.findIndex(f => f.path === filePath);
        if (fileIndex !== -1 && !changedFiles.value[fileIndex].diffLoaded) {
          const fileStatus = changedFiles.value[fileIndex].status;
          
          // For added or deleted files, no need to fetch diff
          if (fileStatus === 'Added' || fileStatus === 'Deleted') {
            changedFiles.value[fileIndex].diffLoaded = true;
            return;
          }
          
          // For modified files, fetch the diff using authenticated API
          try {
            const response = await api.get(`/file/diff`, {
              params: {
                filePath: filePath
              },
              headers: {
                'workspace-id': workspaceId.value
              }
            });
            
            const data = response.data;
            
            if (data.success && data.diff) {
              // Format diff using diff2html
              const diffJson = parse(data.diff);
              changedFiles.value[fileIndex].formattedDiff = html(diffJson, {
                drawFileList: false,
                matching: 'lines',
                outputFormat: 'side-by-side',
                renderNothingWhenEmpty: false,
              });
            } else {
              changedFiles.value[fileIndex].formattedDiff = '<div class="no-diff-data">No changes found in diff.</div>';
            }
          } catch (error) {
            console.error('Error loading diff:', error);
            changedFiles.value[fileIndex].formattedDiff = '<div class="error-message">Error loading diff</div>';
          } finally {
            changedFiles.value[fileIndex].diffLoaded = true;
          }
        }
      }
    };

    const getStatusClass = (status) => {
      if (status === 'Modified') return 'status-modified';
      if (status === 'Added') return 'status-new';
      if (status === 'Deleted') return 'status-deleted';
      if (status === 'Renamed') return 'status-renamed';
      return '';
    };

    const goToNextStep = () => {
      currentStep.value = 2;
      nextTick(() => {
        const titleInput = document.querySelector('[ref="proposeTitleInput"]');
        if (titleInput) {
          titleInput.focus();
        }
      });
    };
    
    const goToPreviousStep = () => {
      currentStep.value = 1;
    };

    const cancel = () => {
      isOpen.value = false;
      if (resolvePromise) {
        resolvePromise({ canceled: true });
      }
    };
    
    const close = () => {
      isOpen.value = false;
      if (resolvePromise) {
        resolvePromise({ 
          success: proposalSuccess.value,
          branchName: proposalBranchName.value,
          pullRequestUrl: pullRequestUrl.value
        });
      }
    };

    const submitProposal = async () => {
      if (!proposeChangesTitle.value.trim()) return;
      
      try {
        emit('loading', 'Submitting proposal...');
        
        if (!workspaceId.value) {
          throw new Error('No workspace ID found');
        }
        
        // Use authenticated API for proposal submission
        const response = await api.post(`/workspace/${workspaceId.value}/propose`, {
          title: proposeChangesTitle.value,
          description: proposeChangesDescription.value
        }, {
          headers: {
            'Content-Type': 'application/json',
            'workspace-id': workspaceId.value
          }
        });

        const data = response.data;

        if (data.success) {
          currentStep.value = 3;
          proposalSubmitted.value = true;
          proposalSuccess.value = true;
          proposalBranchName.value = data.branchName;
          proposalInstructions.value = data.instructions || 'No instructions provided.';
          pullRequestUrl.value = data.pullRequestUrl || '';
          automaticPr.value = data.automaticPr || false;
        } else {
          currentStep.value = 3;
          proposalSubmitted.value = true;
          proposalSuccess.value = false;
          proposalErrorMessage.value = data.message || 'Unknown error occurred.';
        }
      } catch (error) {
        console.error('Error submitting proposal:', error);
        currentStep.value = 3;
        proposalSubmitted.value = true;
        proposalSuccess.value = false;
        proposalErrorMessage.value = error.response?.data?.message || 'Failed to submit proposal. Check console for details.';
      } finally {
        emit('done');
      }
    };

    return {
      isOpen,
      currentStep,
      workspaceId,
      changedFiles,
      isLoadingChanges,
      hasChanges,
      expandedFiles,
      proposeChangesTitle,
      proposeChangesDescription,
      proposalSubmitted,
      proposalSuccess,
      proposalBranchName,
      proposalInstructions,
      proposalErrorMessage,
      pullRequestUrl,
      automaticPr,
      show,
      toggleFileDiff,
      getStatusClass,
      goToNextStep,
      goToPreviousStep,
      cancel,
      close,
      submitProposal
    };
  }
}
</script>

<style>
.d2h-code-side-linenumber {
  position: static;
}
.d2h-file-header {
  display: none;
}
.d2h-file-wrapper {
  margin: 0;
}
</style>
<style scoped>
/* Changed files diff styles */
.diff-container {
  max-height: 700px; /* Increased to allow for better diff viewing */
  overflow-y: auto;
}

.loading-changes {
  text-align: center;
  padding: 2rem 0;
}

.loading-spinner {
  display: inline-block;
  width: 30px;
  height: 30px;
  border: 3px solid rgba(0, 123, 255, 0.3);
  border-radius: 50%;
  border-top-color: #007bff;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.no-changes {
  text-align: center;
  padding: 2rem;
  color: #6c757d;
}

.changed-files-list {
  margin-top: 1rem;
}

.changed-file {
  margin-bottom: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}

.file-header {
  padding: 0.5rem;
  background-color: #f5f5f5;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.file-header:hover {
  background-color: #e9ecef;
}

.file-status {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  margin-right: 0.5rem;
  font-size: 0.8rem;
  border-radius: 3px;
  font-weight: bold;
}

.status-modified {
  background-color: #f0ad4e;
  color: white;
}

.status-new {
  background-color: #5cb85c;
  color: white;
}

.status-deleted {
  background-color: #d9534f;
  color: white;
}

.status-renamed {
  background-color: #5bc0de;
  color: white;
}

.file-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toggle-icon {
  margin-left: 0.5rem;
}

.file-diff {
  padding: 0;
  background-color: #f9f9f9;
  border-top: 1px solid #ddd;
  overflow-x: auto;
}

/* Special messages for new/deleted files */
.diff-message {
  padding: 10px;
  border-radius: 4px;
  font-weight: bold;
  display: flex;
  align-items: center;
}

.new-file-message {
  background-color: #e6ffed;
  color: #22863a;
}

.deleted-file-message {
  background-color: #ffeef0;
  color: #cb2431;
}

.diff-icon {
  font-size: 1.2em;
  margin-right: 8px;
  font-weight: bold;
}

/* Styling for diff2html container */
.diff2html-container {
  font-family: monospace;
  font-size: 0.9rem;
}

/* Override diff2html styles to match our app theme */
:deep(.d2h-file-header) {
  background-color: #f1f8ff;
  border-color: #c8e1ff;
}

:deep(.d2h-file-name) {
  color: #0366d6;
  font-weight: bold;
}

:deep(.d2h-code-line-ctn) {
  color: #24292e;
}

:deep(.d2h-code-linenumber) {
  color: #586069;
}

:deep(.d2h-code-side-linenumber) {
  color: #586069;
}

:deep(.d2h-code-line del) {
  background-color: #ffeef0;
}

:deep(.d2h-code-line ins) {
  background-color: #e6ffed;
}

:deep(.d2h-code-side-line del) {
  background-color: #ffeef0;
}

:deep(.d2h-code-side-line ins) {
  background-color: #e6ffed;
}

/* Loading state for diffs */
.loading-diff {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  color: #586069;
}

.loading-spinner.small {
  width: 16px;
  height: 16px;
  margin-right: 8px;
}

.no-diff-data {
  padding: 1rem;
  color: #586069;
  font-style: italic;
}

.modal-inner {
  height: 100%;
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
  justify-content: center;
  gap: 0.5rem;
}

.pr-url {
  color: #007bff;
  text-decoration: none;
  word-break: break-all;
}

.pr-url:hover {
  text-decoration: underline;
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

.instructions pre {
  white-space: pre-wrap;
  background-color: #f8f8f8;
  padding: 1rem;
  border-radius: 4px;
  font-size: 0.9rem;
  max-height: 200px;
  overflow-y: auto;
  text-align: left;
}
</style>