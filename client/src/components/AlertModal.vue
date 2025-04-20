<template>
  <Modal v-model="isOpen" :title="title">
    <div class="alert-message">{{ message }}</div>
    <template #footer>
      <div class="d-flex justify-content-end">
        <base-button variant="primary" @click="close">OK</base-button>
      </div>
    </template>
  </Modal>
</template>

<script>
import Modal from './Modal.vue';
import BaseButton from './BaseButton.vue';

export default {
  name: 'AlertModal',
  components: { Modal, BaseButton },
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
</style>