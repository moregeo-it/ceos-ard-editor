<template>
  <Modal v-model="isVisible" title="Create New Workspace">
    <div class="form-container">
      <div class="form-group">
        <label for="workspaceTitle">Workspace Title</label>
        <input 
          id="workspaceTitle" 
          v-model="workspaceTitle" 
          type="text" 
          placeholder="Enter workspace title"
          @keyup.enter="submit"
        >
      </div>
      <div v-if="availablePfs.length > 0" class="form-group">
        <label for="defaultPfs">Default PFS</label>
        <select id="defaultPfs" v-model="defaultPfs">
          <option v-for="pfs in availablePfs" :key="pfs" :value="pfs">{{ pfs }}</option>
        </select>
        <div class="helper-text">This PFS will be selected by default in the preview pane.</div>
      </div>
      <div class="form-description">
        <p>A new workspace will be created with a fork of the CEOS-ARD repository.</p>
      </div>
    </div>
    <template #footer>
      <button @click="close" class="secondary-button">Cancel</button>
      <button @click="submit" class="primary-button" :disabled="isSubmitting">
        {{ isSubmitting ? 'Creating...' : 'Create Workspace' }}
      </button>
    </template>
  </Modal>
</template>

<script>
import { ref, onMounted } from 'vue';
import Modal from './Modal.vue';
import api from '../services/auth';

export default {
  name: 'CreateWorkspaceModal',
  components: {
    Modal
  },
  emits: ['workspace-created'],
  setup(props, { emit }) {
    const isVisible = ref(false);
    const workspaceTitle = ref('');
    const isSubmitting = ref(false);
    const availablePfs = ref([]);
    const defaultPfs = ref('');
    const isLoadingPfs = ref(false);

    const show = () => {
      workspaceTitle.value = ''; // Reset title when showing modal
      isVisible.value = true;
      loadPfsFolders();
    };

    const close = () => {
      isVisible.value = false;
    };

    const loadPfsFolders = async () => {
      isLoadingPfs.value = true;
      
      try {
        // Use the list-pfs endpoint that now fetches directly from GitHub
        const response = await api.get('/file/list-pfs');
        
        if (response.data.success && response.data.pfsFolders.length > 0) {
          availablePfs.value = response.data.pfsFolders;
          defaultPfs.value = availablePfs.value[0];
        } else {
          // If no PFS folders found or error occurred, don't show the selection
          availablePfs.value = [];
          defaultPfs.value = '';
        }
      } catch (error) {
        console.error('Error loading PFS folders:', error);
        // Don't show any selection on error
        availablePfs.value = [];
        defaultPfs.value = '';
      } finally {
        isLoadingPfs.value = false;
      }
    };

    const submit = async () => {
      if (!workspaceTitle.value.trim()) {
        workspaceTitle.value = 'Untitled Workspace';
      }

      isSubmitting.value = true;
      try {
        const response = await api.post('/workspace/create', {
          title: workspaceTitle.value,
          defaultPfs: defaultPfs.value
        });
        
        if (response.data.success) {
          // Emit event with the created workspace data
          emit('workspace-created', response.data.workspace);
          close();
          return response.data;
        } else {
          console.error('Failed to create workspace:', response.data.message);
          return null;
        }
      } catch (error) {
        console.error('Error creating workspace:', error);
        return null;
      } finally {
        isSubmitting.value = false;
      }
    };

    // Load PFS folders when component is mounted
    onMounted(() => {
      loadPfsFolders();
    });

    return {
      isVisible,
      workspaceTitle,
      defaultPfs,
      availablePfs,
      isSubmitting,
      isLoadingPfs,
      show,
      close,
      submit
    };
  }
};
</script>

<style scoped>
.form-container {
  margin-bottom: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
}

.form-group input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.form-description {
  font-size: 0.9rem;
  color: #666;
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

.primary-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.helper-text {
  font-size: 0.8rem;
  color: #666;
  margin-top: 0.25rem;
}

.error-text {
  font-size: 0.8rem;
  color: red;
  margin-top: 0.25rem;
}
</style>