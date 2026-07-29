import { on } from '@/services/events';

/**
 * Bus event subscriptions for components: call `this.onEvent(pattern, handler)` (typically in
 * `created()`); every subscription is removed automatically in `beforeUnmount`.
 */
export default {
  created() {
    this._eventUnsubscribers = [];
  },

  beforeUnmount() {
    this._eventUnsubscribers.forEach((off) => off());
    this._eventUnsubscribers = [];
  },

  methods: {
    /**
     * Subscribe to bus events for the lifetime of this component.
     *
     * @param {string} pattern Exact type (`EVENTS.FILE_SAVED`), namespace (`'file.*'`), or `'*'`.
     * @param {(event: import('@/services/events').WorkspaceEvent) => any} handler
     * @returns {() => void} Unsubscribe function for early removal (optional).
     */
    onEvent(pattern, handler) {
      const off = on(pattern, handler);
      this._eventUnsubscribers.push(off);
      return off;
    },
  },
};
