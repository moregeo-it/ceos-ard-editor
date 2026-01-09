import { defineStore } from 'pinia';

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    show: false,
    message: '',
    type: 'info', // 'success', 'error', 'warning', 'info'
    timeout: 5000,
  }),

  actions: {
    showNotification({ message, type = 'info', timeout = 5000 }) {
      this.message = message;
      this.type = type;
      this.timeout = timeout;
      this.show = true;
    },

    success(message, timeout = 5000) {
      this.showNotification({ message, type: 'success', timeout });
    },

    error(message, timeout = 7000) {
      this.showNotification({ message, type: 'error', timeout });
    },

    warning(message, timeout = 6000) {
      this.showNotification({ message, type: 'warning', timeout });
    },

    info(message, timeout = 5000) {
      this.showNotification({ message, type: 'info', timeout });
    },

    hide() {
      this.show = false;
    },
  },
});
