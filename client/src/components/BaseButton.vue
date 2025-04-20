<template>
  <button
    :class="[
      'base-button',
      `variant-${variant}`,
      { 'size-small': size === 'small' },
      { 'full-width': fullWidth }
    ]"
    :type="type"
    :disabled="disabled"
    @click="onClick"
  >
    <span v-if="$slots.icon" class="button-icon">
      <slot name="icon"></slot>
    </span>
    <slot></slot>
  </button>
</template>

<script>
export default {
  name: 'BaseButton',
  props: {
    // Button appearance: primary, secondary, danger, success, outline
    variant: {
      type: String,
      default: 'primary',
      validator: (value) => ['primary', 'secondary', 'danger', 'success', 'outline'].includes(value)
    },
    // Button size: normal or small
    size: {
      type: String,
      default: 'normal',
      validator: (value) => ['normal', 'small'].includes(value)
    },
    // Button type (HTML attribute)
    type: {
      type: String,
      default: 'button'
    },
    // Disabled state
    disabled: {
      type: Boolean,
      default: false
    },
    // Whether the button should take full width
    fullWidth: {
      type: Boolean,
      default: false
    }
  },
  methods: {
    onClick(event) {
      this.$emit('click', event);
    }
  }
}
</script>

<style>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 500;
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  min-height: 36px;
}

/* Size variants */
.size-small {
  font-size: 0.85rem;
  padding: 0.3rem 0.8rem;
  min-height: 30px;
}

/* Full width */
.full-width {
  width: 100%;
}

/* Button variants */
.variant-primary {
  background-color: #007bff;
  color: white;
}

.variant-primary:hover:not(:disabled) {
  background-color: #0069d9;
}

.variant-secondary {
  background-color: #6c757d;
  color: white;
}

.variant-secondary:hover:not(:disabled) {
  background-color: #5a6268;
}

.variant-danger {
  background-color: #dc3545;
  color: white;
}

.variant-danger:hover:not(:disabled) {
  background-color: #c82333;
}

.variant-success {
  background-color: #28a745;
  color: white;
}

.variant-success:hover:not(:disabled) {
  background-color: #218838;
}

.variant-outline {
  background-color: transparent;
  border: 1px solid #6c757d;
  color: #6c757d;
}

.variant-outline:hover:not(:disabled) {
  background-color: #ffffff;
  color: #000000;
}

/* Disabled state for all variants */
.base-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

/* Button icon styling */
.button-icon {
  display: inline-flex;
  margin-right: 0.5rem;
}
</style>