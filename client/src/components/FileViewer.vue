<template>
  <div class="file-viewer-container">
    <div class="viewer-header">
      <div class="file-info">
        <h3 class="file-name">{{ filename || 'Untitled' }}</h3>
        <div class="file-type-indicator">{{ getFileType() }}</div>
      </div>
    </div>
    <div class="viewer-content">
      <!-- Image viewer -->
      <div v-if="isImageFile" class="image-viewer">
        <img :src="fileUrl" alt="Image preview" />
      </div>
      
      <!-- PDF viewer -->
      <div v-else-if="isPdfFile" class="pdf-viewer">
        <iframe :src="fileUrl" title="PDF preview"></iframe>
      </div>
      
      <!-- Binary file message -->
      <div v-else class="binary-viewer">
        <div class="binary-message">
          <div class="icon large-icon">📁</div>
          <h3>{{ getFileExtension().toUpperCase() }} File</h3>
          <p>This file cannot be displayed in the editor.</p>
          <div class="actions">
            <button @click="downloadFile" class="action-button">Download File</button>
            <button @click="openInNewTab" class="action-button">Open in New Tab</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';

const API_URL = 'http://localhost:3000/api';

export default {
  name: 'FileViewer',
  props: {
    filename: {
      type: String,
      default: ''
    }
  },
  setup(props) {
    // Generate URL for the file
    const fileUrl = computed(() => {
      const workspaceId = localStorage.getItem('workspaceId');
      if (!workspaceId || !props.filename) return '';
      
      return `${API_URL}/file/view/${encodeURIComponent(props.filename)}?workspace-id=${workspaceId}`;
    });
    
    // File type checks
    const isImageFile = computed(() => {
      const ext = getFileExtension();
      return ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext);
    });
    
    const isPdfFile = computed(() => {
      return getFileExtension() === 'pdf';
    });
    
    // Helper functions
    const getFileExtension = () => {
      if (!props.filename) return '';
      const parts = props.filename.split('.');
      return parts.length > 1 ? parts.pop().toLowerCase() : '';
    };
    
    const getFileType = () => {
      const ext = getFileExtension();
      
      switch(ext) {
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'svg':
        case 'webp':
        case 'bmp':
          return 'Image';
        case 'pdf':
          return 'PDF Document';
        case 'doc':
        case 'docx':
          return 'Word Document';
        case 'xls':
        case 'xlsx':
          return 'Excel Document';
        case 'ppt':
        case 'pptx':
          return 'PowerPoint Document';
        default:
          return ext.toUpperCase() + ' File';
      }
    };
    
    // Action handlers
    const openInNewTab = () => {
      if (fileUrl.value) {
        window.open(fileUrl.value, '_blank');
      }
    };
    
    const downloadFile = () => {
      if (fileUrl.value) {
        const a = document.createElement('a');
        a.href = fileUrl.value;
        a.download = props.filename.split('/').pop();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    };
    
    return {
      fileUrl,
      isImageFile,
      isPdfFile,
      getFileExtension,
      getFileType,
      openInNewTab,
      downloadFile
    };
  }
};
</script>

<style scoped>
.file-viewer-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.viewer-header {
  flex: 0 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background-color: #f5f5f5;
  border-bottom: 1px solid #ddd;
  min-height: 3.5rem;
}

.file-info {
  display: flex;
  align-items: center;
}

.file-name {
  margin: 0;
  margin-right: 0.5rem;
  font-size: 1rem;
}

.file-type-indicator {
  font-size: 0.8rem;
  color: #666;
  padding: 0.1rem 0.5rem;
  background-color: #eee;
  border-radius: 4px;
}

.viewer-actions {
  display: flex;
  gap: 0.5rem;
}

.icon {
  font-size: 1rem;
}

.viewer-content {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f8f8f8;
}

.image-viewer {
  max-width: 100%;
  max-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.image-viewer img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}

.pdf-viewer {
  width: 100%;
  height: 100%;
}

.pdf-viewer iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.binary-viewer {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.binary-message {
  text-align: center;
  padding: 2rem;
  background-color: white;
  border-radius: 0.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-width: 400px;
}

.large-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.binary-message h3 {
  margin: 0.5rem 0;
}

.binary-message p {
  margin: 0.5rem 0 1.5rem;
  color: #555;
}

.actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.action-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-button:hover {
  background-color: #e0e0e0;
}

.action-button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  background-color: #007acc;
  color: white;
}

.action-button:hover {
  background-color: #0062a3;
  color: white;
}
</style>