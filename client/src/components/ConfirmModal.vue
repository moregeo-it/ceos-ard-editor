<template>
  <Modal v-model="isOpen" :title="title">
    <div class="confirm-message">{{ message }}</div>
    <template #footer>
      <button class="modal-button cancel-button" @click="cancel">Cancel</button>
      <button class="modal-button confirm-button" @click="confirm">{{ confirmText }}</button>
    </template>
  </Modal>
</template>

<script>
import Modal from './Modal.vue';

export default {
  name: 'ConfirmModal',
  components: { Modal },
  props: {
    title: {
      type: String,
      default: 'Confirm'
    },
    message: {
      type: String,
      required: true
    },
    confirmText: {
      type: String,
      default: 'Confirm'
    }
  },
  data() {
    return {
      isOpen: false
    };
  },
  methods: {
    show() {
      this.isOpen = true;
      return new Promise(resolve => {
        this.resolvePromise = resolve;
      });
    },
    confirm() {
      this.isOpen = false;
      if (this.resolvePromise) {
        this.resolvePromise(true);
      }
    },
    cancel() {
      this.isOpen = false;
      if (this.resolvePromise) {
        this.resolvePromise(false);
      }
    }
  }
}
</script>

<style scoped>
.confirm-message {
  margin-bottom: 10px;
  white-space: pre-line;
}

.modal-button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.cancel-button {
  background-color: #6c757d;
  color: white;
}

.cancel-button:hover {
  background-color: #5a6268;
}

.confirm-button {
  background-color: #dc3545;
  color: white;
  margin-left: 10px;
}

.confirm-button:hover {
  background-color: #c82333;
}
</style>