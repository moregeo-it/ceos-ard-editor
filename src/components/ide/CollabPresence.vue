<template>
  <div v-if="peers.length" class="collab-presence d-flex align-center">
    <v-tooltip v-for="peer in peers" :key="peer.clientId" :text="peer.name">
      <template v-slot:activator="{ props }">
        <v-avatar v-bind="props" size="24" :color="peer.color" class="mr-1">
          <span class="text-caption text-white">{{ initials(peer.name) }}</span>
        </v-avatar>
      </template>
    </v-tooltip>
  </div>
</template>

<script>
export default {
  name: 'CollabPresence',

  props: {
    // Live Yjs session for the active file ({ awareness }), if collaboration is active.
    collab: {
      type: Object,
      default: null,
    },
  },

  data() {
    return {
      peers: [],
    };
  },

  watch: {
    collab: {
      immediate: true,
      handler(newValue, oldValue) {
        if (oldValue?.awareness) {
          oldValue.awareness.off('change', this.refresh);
        }
        if (newValue?.awareness) {
          newValue.awareness.on('change', this.refresh);
        }
        this.refresh();
      },
    },
  },

  beforeUnmount() {
    if (this.collab?.awareness) {
      this.collab.awareness.off('change', this.refresh);
    }
  },

  methods: {
    refresh() {
      if (!this.collab?.awareness) {
        this.peers = [];
        return;
      }
      const localId = this.collab.awareness.clientID;
      const peers = [];
      this.collab.awareness.getStates().forEach((state, clientId) => {
        if (clientId === localId || !state?.user) {
          return;
        }
        peers.push({
          clientId,
          name: state.user.name || 'Anonymous',
          color: state.user.color || '#9e9e9e',
        });
      });
      this.peers = peers;
    },
    initials(name) {
      return (name || '?')
        .trim()
        .split(/\s+/)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    },
  },
};
</script>
