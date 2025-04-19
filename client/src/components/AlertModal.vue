<template>
  <Modal v-model="isOpen" :title="title">
    <div class="alert-message">{{ message }}</div>
    <template #footer>
      <button class="modal-button" @click="close">OK</button>
    </template>
  </Modal>
</template>

<script>
import Modal from './Modal.vue';

export default {
  name: 'AlertModal',
  components: { Modal },
  props: {
    title: {
      type: String,
      default: 'Alert'
    },
    message: {
      type: String,
      required: true
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
    close() {
      this.isOpen = false;
      if (this.resolvePromise) {
        this.resolvePromise();
      }
    }
  }
}
</script>

<style scoped>
.alert-message {
  margin-bottom: 10px;
  white-space: pre-line;
}

.modal-button {
  padding: 8px 16px;
  background-color: #4d85bd;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.modal-button:hover {
  background-color: #3a6d9e;
}
</style>