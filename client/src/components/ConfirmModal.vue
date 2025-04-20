<template>
  <Modal v-model="isOpen" :title="title">
    <div class="confirm-message">{{ message }}</div>
    <template #footer>
      <div class="d-flex justify-content-end gap-2">
        <base-button variant="secondary" @click="cancel">Cancel</base-button>
        <base-button variant="danger" @click="confirm">{{ confirmText }}</base-button>
      </div>
    </template>
  </Modal>
</template>

<script>
import Modal from './Modal.vue';
import BaseButton from './BaseButton.vue';

export default {
  name: 'ConfirmModal',
  components: { Modal, BaseButton },
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
</style>