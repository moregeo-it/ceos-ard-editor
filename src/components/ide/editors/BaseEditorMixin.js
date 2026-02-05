export default {
  emits: ['update', 'save'],
  data() {
    return {
      data: '',
    };
  },
  props: {
    value: {
      type: [String, Object],
      required: true,
    },
    file: {
      type: Object,
      required: true,
    },
    readOnly: {
      type: Boolean,
      default: false,
    },
  },
  watch: {
    value: {
      immediate: true,
      handler(newValue) {
        this.data = newValue;
      },
    },
    data(newValue) {
      this.$emit('update', newValue);
    },
  },
};
