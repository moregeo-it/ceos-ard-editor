import { useNotificationsStore } from '@/stores/notifications';

export default {
  emits: ['accept', 'reject'],
  data() {
    return {
      show: true,
      accepting: false,
      sizes: {
        small: 400,
        medium: 600,
        large: '90%',
      },
    };
  },
  props: {
    onAcceptance: {
      type: Function,
      default: null,
    },
  },
  computed: {
    notifications() {
      return useNotificationsStore();
    },
  },
  watch: {
    show(newVal) {
      if (!newVal) {
        this.$emit('reject');
      }
    },
  },
  methods: {
    async accept(value) {
      this.accepting = true;
      if (typeof this.onAcceptance === 'function') {
        try {
          await this.onAcceptance(value);
          this.$emit('accept', value);
        } catch (error) {
          this.notifications.error(error.message);
          this.accepting = false;
          return;
        }
      } else {
        this.$emit('accept', value);
      }
      this.accepting = false;
      this.show = false;
    },
    reject() {
      this.show = false;
    },
  },
};
