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
      v-show="!isGenerating && content"
    ></iframe>
    
    <div v-if="!isGenerating && !content" class="no-preview">
      <p>No preview available. Generate a preview to see the document.</p>
    </div>
  </div>
</template>

<script>
import { ref, watch, onMounted, onUnmounted } from 'vue';

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
    }
  },
  emits: ['preview-change', 'build-started', 'build-completed'],
  setup(props, { emit }) {
    const previewFrame = ref(null);
    const scrollPosition = ref({ x: 0, y: 0 });
    const previewOptions = ref([]);
    const selectedPreview = ref('');
    const isGenerating = ref(false);
    const buildStatus = ref('');
    const buildStatusMessage = ref('Preparing build...');
    const buildLogs = ref('');
    const showLogs = ref(false);
    let statusPollInterval = null;
    
    // Process preview files to create dropdown options
    watch(() => props.previewFiles, (newFiles) => {
      if (!newFiles || newFiles.length === 0) return;
      
      // Create options with better formatting for display
      previewOptions.value = newFiles.map(file => ({
        label: file.name.replace('.html', ''),
        value: file.path
      }));
      
      // Set default selected preview if not already set
      if (!selectedPreview.value && previewOptions.value.length > 0) {
        selectedPreview.value = previewOptions.value[0].value;
        emit('preview-change', selectedPreview.value);
      }
    });

    // Handle preview selection change
    const onPreviewChange = () => {
      emit('preview-change', selectedPreview.value);
    };
    
    // Generate new preview (build)
    const generatePreview = async () => {
      const API_URL = 'http://localhost:3000/api';
      const workspaceId = localStorage.getItem('workspaceId');
      
      if (!workspaceId) {
        alert('No workspace selected');
        return;
      }
      
      try {
        isGenerating.value = true;
        buildStatus.value = 'starting';
        buildStatusMessage.value = 'Starting build process...';
        buildLogs.value = '';
        emit('build-started');
        
        // Start the build process
        const response = await fetch(`${API_URL}/preview/build`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Workspace-Id': workspaceId
          }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Failed to start build');
        }
        
        // If build started successfully, poll for status
        startStatusPolling(workspaceId);
        
      } catch (error) {
        console.error('Error generating preview:', error);
        buildStatus.value = 'failed';
        buildStatusMessage.value = `Build failed: ${error.message}`;
        isGenerating.value = false;
        emit('build-completed', { success: false, error: error.message });
      }
    };
    
    // Poll for build status
    const startStatusPolling = (workspaceId) => {
      const API_URL = 'http://localhost:3000/api';
      
      // Clear any existing interval
      if (statusPollInterval) {
        clearInterval(statusPollInterval);
      }
      
      // Set up polling interval (every 2 seconds)
      statusPollInterval = setInterval(async () => {
        try {
          const response = await fetch(`${API_URL}/preview/build-status`, {
            headers: {
              'Workspace-Id': workspaceId
            }
          });
          
          if (!response.ok) {
            throw new Error('Failed to get build status');
          }
          
          const data = await response.json();
          buildStatus.value = data.status;
          
          // Update logs
          if (data.logs && data.logs.length > 0) {
            buildLogs.value = data.logs.map(log => log.text).join('');
          }
          
          // Update status message based on build status
          switch (data.status) {
            case 'starting':
              buildStatusMessage.value = 'Preparing build environment...';
              break;
            case 'in_progress':
              buildStatusMessage.value = 'Building documents...';
              break;
            case 'completed':
              buildStatusMessage.value = 'Build completed successfully!';
              // Stop polling and refresh the preview list
              clearInterval(statusPollInterval);
              statusPollInterval = null;
              isGenerating.value = false;
              emit('build-completed', { success: true });
              break;
            case 'failed':
              buildStatusMessage.value = `Build failed: ${data.error || 'Unknown error'}`;
              // Stop polling
              clearInterval(statusPollInterval);
              statusPollInterval = null;
              isGenerating.value = false;
              emit('build-completed', { success: false, error: data.error });
              break;
            default:
              buildStatusMessage.value = `Build status: ${data.status}`;
          }
        } catch (error) {
          console.error('Error polling build status:', error);
          buildStatusMessage.value = `Error checking build status: ${error.message}`;
        }
      }, 2000);
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
      fixRelativeUrls(iframeDoc);
      
      // Restore scroll position after content has been updated and rendered
      setTimeout(() => {
        if (iframe.contentWindow) {
          iframe.contentWindow.scrollTo(scrollPosition.value.x, scrollPosition.value.y);
        }
      }, 100);
    };
    
    // Helper to fix relative URLs in the iframe
    const fixRelativeUrls = (iframeDoc) => {
      const API_URL = 'http://localhost:3000/api';
      const workspaceId = localStorage.getItem('workspaceId');
      
      if (!workspaceId) return;
      
      // Fix relative links
      const links = iframeDoc.querySelectorAll('a[href]');
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && !href.startsWith('http') && !href.startsWith('#')) {
          link.setAttribute('href', `${API_URL}/preview/static/${href}?workspace-id=${workspaceId}`);
        }
      });
      
      // Fix relative images
      const images = iframeDoc.querySelectorAll('img[src]');
      images.forEach(img => {
        const src = img.getAttribute('src');
        if (src && !src.startsWith('http')) {
          img.setAttribute('src', `${API_URL}/preview/static/${src}?workspace-id=${workspaceId}`);
        }
      });
      
      // Fix relative stylesheets
      const stylesheets = iframeDoc.querySelectorAll('link[rel="stylesheet"]');
      stylesheets.forEach(sheet => {
        const href = sheet.getAttribute('href');
        if (href && !href.startsWith('http')) {
          sheet.setAttribute('href', `${API_URL}/preview/static/${href}?workspace-id=${workspaceId}`);
        }
      });
      
      // Fix relative scripts
      const scripts = iframeDoc.querySelectorAll('script[src]');
      scripts.forEach(script => {
        const src = script.getAttribute('src');
        if (src && !src.startsWith('http')) {
          script.setAttribute('src', `${API_URL}/preview/static/${src}?workspace-id=${workspaceId}`);
        }
      });
    };
    
    // Watch for changes in content prop
    watch(() => props.content, () => {
      updateIframeContent();
    });
    
    // Initial render on mount
    onMounted(() => {
      updateIframeContent();
    });
    
    // Clean up on unmount
    onUnmounted(() => {
      if (statusPollInterval) {
        clearInterval(statusPollInterval);
      }
    });
    
    return {
      previewFrame,
      previewOptions,
      selectedPreview,
      isGenerating,
      buildStatusMessage,
      buildLogs,
      showLogs,
      onPreviewChange,
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

.generate-btn {
  padding: 0.25rem 0.5rem;
  background-color: #007acc;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.generate-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
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
  top: 3rem; /* Below header */
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

.loading-indicator {
  text-align: center;
  padding: 2rem;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-width: 80%;
  width: 500px;
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