<template>
  <div class="preview-pane-container">
    <div v-if="isGenerating" class="loading-overlay">
      <div class="loading-indicator">
        <div class="spinner"></div>
        <p>{{ buildStatusMessage }}</p>
        <div class="log-container" v-if="showLogs">
          <pre>{{ buildLogs }}</pre>
        </div>
        <button @click="showLogs = !showLogs" class="toggle-logs-btn">
          {{ showLogs ? 'Hide Logs' : 'Show Logs' }}
        </button>
      </div>
    </div>
    
    <iframe 
      ref="previewFrame"
      class="preview-frame"
      sandbox="allow-same-origin"
      title="HTML Preview"
      v-show="content"
      :style="{'pointer-events': isResizing ? 'none' : 'auto'}"
    ></iframe>
    
    <div v-if="!content" class="no-preview">
      <p>No preview available yet.</p>
    </div>
  </div>
</template>

<script>
import { ref, watch, onMounted, onUnmounted, inject } from 'vue';
import { API_URL } from '../config.js';
import api from '../services/auth.js';
import buildService from '../services/BuildService.js';

export default {
  name: 'PreviewPane',
  props: {
    content: {
      type: String,
      default: ''
    },
    previewFiles: {
      type: Array,
      default: () => []
    },
    selectedPreviewName: {
      type: String,
      default: ''
    },
    isResizing: {
      type: Boolean,
      default: false
    },
    workspaceId: {
      type: String,
      required: true
    }
  },
  emits: ['preview-change', 'build-started', 'build-completed', 'open-file'],
  setup(props, { emit }) {
    const previewFrame = ref(null);
    const scrollPosition = ref({ x: 0, y: 0 });
    const isGenerating = ref(false);
    const buildStatusMessage = ref('Preparing build...');
    const buildLogs = ref('');
    const showLogs = ref(false);
    let statusListenerUnsubscribe = null;
    
    // Inject modal functions from App.vue
    const showAlert = inject('showAlert');
    
    // Watch for changes in content prop to update the iframe
    watch(() => props.content, () => {
      updateIframeContent();
    });

    // Generate new preview for a specific file
    const generatePreview = async (previewName) => {
      if (!props.workspaceId) {
        showAlert('No workspace selected', 'Error');
        return;
      }
      
      if (!previewName) {
        console.error('No preview name provided for rebuild');
        return;
      }
      
      try {
        isGenerating.value = true;
        buildStatusMessage.value = 'Regenerating document...';
        buildLogs.value = '';
        emit('build-started');
        
        // Extract the PFS name from the filename (remove .html extension)
        const pfsName = previewName.replace('.html', '');
        
        // Use the buildService to start the build and monitor status
        const result = await buildService.startBuild(props.workspaceId, pfsName);
        
        if (result.success) {
          startStatusMonitoring();
        } else {
          isGenerating.value = false;
          buildStatusMessage.value = `Build failed: ${result.error || 'Unknown error'}`;
          emit('build-completed', { success: false, error: result.error || 'Unknown error' });
        }
      } catch (error) {
        console.error('Error generating preview:', error);
        buildStatusMessage.value = `Build failed: ${error.message || error.response?.data?.message || 'Unknown error'}`;
        isGenerating.value = false;
        emit('build-completed', { success: false, error: error.message || error.response?.data?.message || 'Unknown error' });
      }
    };
    
    // Monitor build status using the buildService
    const startStatusMonitoring = () => {
      // Clean up any existing listeners
      if (statusListenerUnsubscribe) {
        statusListenerUnsubscribe();
      }
      
      // Register a new listener for build status changes
      statusListenerUnsubscribe = buildService.addStatusListener((statusData) => {
        // Update UI based on status
        if (statusData.status) {
          // Update status message
          buildStatusMessage.value = buildService.getStatusMessage();
          
          // Update logs if available
          if (statusData.logs) {
            buildLogs.value = statusData.logs;
          }
          
          // Handle completion
          if (statusData.status === 'completed') {
            setTimeout(() => {
              isGenerating.value = false;
              emit('build-completed', { success: true });
            }, 1000);
          } 
          // Handle failure
          else if (statusData.status === 'failed') {
            setTimeout(() => {
              isGenerating.value = false;
              emit('build-completed', { success: false, error: statusData.error });
            }, 1000);
          }
        }
      });
    };
    
    // Update iframe content when the content prop changes
    const updateIframeContent = () => {
      if (!previewFrame.value || !props.content) return;
      
      const iframe = previewFrame.value;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      
      // Save current scroll position before updating content
      if (iframe.contentWindow) {
        scrollPosition.value = {
          x: iframe.contentWindow.scrollX,
          y: iframe.contentWindow.scrollY
        };
      }
      
      // Write content to iframe
      iframeDoc.open();
      iframeDoc.write(props.content);
      iframeDoc.close();
      
      // Fix relative URLs in the iframe content
      enhanceDoc(iframeDoc);
      
      // Restore scroll position after content has been updated and rendered
      setTimeout(() => {
        if (iframe.contentWindow) {
          iframe.contentWindow.scrollTo(scrollPosition.value.x, scrollPosition.value.y);
        }
      }, 100);
    };
    
    // Helper to fix relative URLs in the iframe
    const enhanceDoc = (iframeDoc) => {
      if (!props.workspaceId) return;
      
      // Fix relative links
      const links = iframeDoc.querySelectorAll('a[href]');
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && !href.startsWith('http') && !href.startsWith('#')) {
          link.setAttribute('href', `${API_URL}/preview/static/${href}?workspace-id=${props.workspaceId}`);
        }
      });
      
      // Fix relative images
      const images = iframeDoc.querySelectorAll('img[src]');
      images.forEach(img => {
        const src = img.getAttribute('src');
        if (src && !src.startsWith('http')) {
          img.setAttribute('src', `${API_URL}/preview/static/${src}?workspace-id=${props.workspaceId}`);
        }
      });
      
      // Fix relative stylesheets
      const stylesheets = iframeDoc.querySelectorAll('link[rel="stylesheet"]');
      stylesheets.forEach(sheet => {
        const href = sheet.getAttribute('href');
        if (href && !href.startsWith('http')) {
          sheet.setAttribute('href', `${API_URL}/preview/static/${href}?workspace-id=${props.workspaceId}`);
        }
      });
      
      // Make Edit buttons clickable
      const editBtns = iframeDoc.querySelectorAll('button[class="edit"]');
      editBtns.forEach(btn => {
        const href = btn.getAttribute('value');
        if (href) {
          btn.addEventListener('click', () => emit('open-file', href));
          btn.addEventListener('mouseover', () => {
            btn.style.backgroundColor = '#0069d9';
          });
          btn.addEventListener('focus', () => {
            btn.style.backgroundColor = '#0069d9';
          });
          btn.addEventListener('mouseout', () => {
            btn.style.backgroundColor = '#007bff';
          });
          btn.addEventListener('blur', () => {
            btn.style.backgroundColor = '#007bff';
          });
          btn.style.float = 'right';
          btn.style.margin = `0 0 0.5rem 0.5rem`;
          btn.style.padding = '0.3rem 0.8rem';
          btn.style.backgroundColor = '#007bff';
          btn.style.color = 'white';
          btn.style.border = 0;
          btn.style.borderRadius = '4px';
          btn.style.cursor = 'pointer';
          btn.style.transition = 'all 0.2s ease';
        }
      });
    };
    
    // Watch for changes in selectedPreviewName prop
    watch(() => props.selectedPreviewName, (newPreviewName, oldPreviewName) => {
      if (newPreviewName !== oldPreviewName && newPreviewName) {
        // Rebuild the selected preview when switching
        generatePreview(newPreviewName);
      }
    });
    
    // Initial render on mount
    onMounted(() => {
      updateIframeContent();
    });
    
    // Clean up on unmount
    onUnmounted(() => {
      if (statusListenerUnsubscribe) {
        statusListenerUnsubscribe();
      }
    });
    
    return {
      previewFrame,
      isGenerating,
      buildStatusMessage,
      buildLogs,
      showLogs,
      generatePreview
    };
  }
};
</script>

<style scoped>
.preview-pane-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.preview-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.preview-select {
  padding: 0.25rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: white;
  color: #000;
  font-size: 0.9rem;
}

.preview-frame {
  flex: 1;
  width: 100%;
  border: none;
  background-color: white;
  overflow: auto;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
  pointer-events: none; /* Allow interaction with the preview underneath */
}

.loading-indicator {
  text-align: center;
  padding: 1.5rem;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-width: 80%;
  width: 400px;
  pointer-events: auto; /* Re-enable pointer events for the indicator */
}

.spinner {
  border: 4px solid rgba(0, 122, 204, 0.2);
  border-left-color: #007acc;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.log-container {
  max-height: 300px;
  overflow-y: auto;
  margin-top: 1rem;
  padding: 0.5rem;
  background-color: #f5f5f5;
  border-radius: 4px;
  text-align: left;
  border: 1px solid #ddd;
}

.log-container pre {
  margin: 0;
  font-family: monospace;
  font-size: 0.8rem;
  white-space: pre-wrap;
}

.toggle-logs-btn {
  margin-top: 0.5rem;
  padding: 0.25rem 0.5rem;
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}

.no-preview {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f9f9f9;
  color: #666;
  text-align: center;
  padding: 2rem;
}
</style>