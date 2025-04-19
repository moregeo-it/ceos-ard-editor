<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-overlay" @click="$emit('update:modelValue', false)">
      <div class="modal-container" ref="modalContainer" @click.stop @mousedown="startDrag" 
        :class="{ 'dragging': isDragging, 'large-modal': isLarge }" 
        :style="modalStyles">
        <div class="modal-header">
          <h3 class="modal-title">{{ title }}</h3>
          <button class="modal-close-button" @click="$emit('update:modelValue', false)">&times;</button>
        </div>
        <div class="modal-body">
          <slot></slot>
        </div>
        <div class="modal-footer">
          <slot name="footer"></slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';

export default {
  name: 'Modal',
  props: {
    modelValue: {
      type: Boolean,
      required: true
    },
    title: {
      type: String,
      default: 'Modal'
    },
    isLarge: {
      type: Boolean,
      default: false
    },
    width: {
      type: String,
      default: ''
    },
    height: {
      type: String,
      default: ''
    }
  },
  emits: ['update:modelValue'],
  setup(props) {
    const modalContainer = ref(null);
    const isDragging = ref(false);
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const modalStyles = computed(() => {
      const styles = {};
      if (props.width) styles.width = props.width;
      if (props.height) styles.height = props.height;
      return styles;
    });

    const startDrag = (event) => {
      // Only start dragging if clicking on the header area
      if (!event.target.closest('.modal-header')) {
        return;
      }

      event.preventDefault();
      if (!modalContainer.value) return;

      isDragging.value = true;
      
      // Get starting position
      const rect = modalContainer.value.getBoundingClientRect();
      startX = event.clientX;
      startY = event.clientY;
      startLeft = rect.left;
      startTop = rect.top;

      // Add global event listeners
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', stopDrag);
    };

    const handleMouseMove = (event) => {
      if (!isDragging.value || !modalContainer.value) return;

      const container = modalContainer.value;
      
      // Calculate new position
      const newLeft = startLeft + (event.clientX - startX);
      const newTop = startTop + (event.clientY - startY);
      
      // Keep modal within viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const modalWidth = container.offsetWidth;
      const modalHeight = container.offsetHeight;
      
      const constrainedLeft = Math.max(0, Math.min(newLeft, viewportWidth - modalWidth));
      const constrainedTop = Math.max(0, Math.min(newTop, viewportHeight - modalHeight));

      // Update position
      container.style.position = 'absolute';
      container.style.left = `${constrainedLeft}px`;
      container.style.top = `${constrainedTop}px`;
    };

    const stopDrag = () => {
      isDragging.value = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopDrag);
    };
    
    // Reset modal position when opened
    watch(() => props.modelValue, (newVal) => {
      if (newVal && modalContainer.value) {
        // Small delay to ensure modal is rendered before repositioning
        setTimeout(() => {
          modalContainer.value.style.position = '';
          modalContainer.value.style.left = '';
          modalContainer.value.style.top = '';
        }, 50);
      }
    });

    // Clean up event listeners when component is unmounted
    onBeforeUnmount(() => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', stopDrag);
    });

    return {
      modalContainer,
      isDragging,
      startDrag,
      modalStyles
    };
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-container {
  position: relative;
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.33);
  width: 400px;
  height: auto;
  min-width: 300px;
  min-height: 200px;
  max-width: 90%;
  max-height: 90%;
  overflow: auto;
  display: flex;
  flex-direction: column;
  resize: both;
  overflow: auto;
}

.modal-container.large-modal {
  width: 80%;
  height: 80%;
}

.modal-container.dragging {
  user-select: none;
  cursor: move;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border-bottom: 1px solid #e7e7e7;
  cursor: move; /* Indicates the header can be used to drag */
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 500;
}

.modal-close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  color: #666;
}

.modal-body {
  padding: 15px;
  flex-grow: 1;
  overflow-y: auto;
}

.modal-footer {
  padding: 15px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  border-top: 1px solid #e7e7e7;
}
</style>