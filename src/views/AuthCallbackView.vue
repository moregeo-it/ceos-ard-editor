<template>
  <v-container class="fill-height">
    <v-row justify="center" align="center">
      <v-col cols="12" md="6" class="text-center">
        <v-card class="pa-8" elevation="4">
          <v-card-text>
            <v-progress-circular
              v-if="!error"
              indeterminate
              size="64"
              color="primary"
              class="mb-4"
            ></v-progress-circular>

            <v-icon v-else size="64" color="error" class="mb-4"> mdi-alert-circle </v-icon>

            <h2 class="text-h5 mb-4">
              {{ error ? 'Authentication Failed' : 'Completing Authentication' }}
            </h2>

            <v-alert v-if="error" type="error" variant="tonal" class="mb-4">
              {{ error }}
            </v-alert>

            <p class="text-body-1 text-medium-emphasis">
              {{
                error
                  ? 'Redirecting to login...'
                  : 'Please wait while we complete your authentication...'
              }}
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { useAuthStore } from '@/stores/auth';
import authService from '@/services/auth.service';

import { useNotificationsStore } from '@/stores/notifications';

export default {
  name: 'AuthCallbackView',

  data() {
    return {
      error: null,
    };
  },

  async created() {
    await this.handleCallback();
  },

  methods: {
    async handleCallback() {
      const authStore = useAuthStore();
      const searchParams = new URLSearchParams(window.location.search);

      // Check for error from backend
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (errorParam) {
        this.error = errorDescription
          ? decodeURIComponent(errorDescription)
          : 'Authentication failed. Please try again.';

        // If in popup, send error to parent
        if (this.isPopup()) {
          this.sendMessageToParent({
            type: 'auth_error',
            error: this.error,
          });
          setTimeout(() => window.close(), 2000);
          return;
        }

        setTimeout(() => {
          this.$router.push({ name: 'landing' });
        }, 3000);
        return;
      }

      try {
        // If opened in popup, send auth data to parent instead of storing locally
        if (this.isPopup()) {
          const authData = authService.parseAuthCallback(searchParams);
          this.sendMessageToParent({
            type: 'auth_success',
            data: authData,
          });
          // Close popup after short delay
          setTimeout(() => window.close(), 1000);
          return;
        }

        // Normal flow - store auth and navigate
        authStore.handleAuthCallback(searchParams);
        this.$router.push({ name: 'workspaces' });
      } catch (error) {
        const notifications = useNotificationsStore();
        notifications.error(`Authentication failed. Please try again. Error: ${error.message}`);

        // If in popup, send error to parent
        if (this.isPopup()) {
          this.sendMessageToParent({
            type: 'auth_error',
            error: error.message,
          });
          setTimeout(() => window.close(), 2000);
          return;
        }

        this.$router.push({ name: 'landing' });
      }
    },

    /**
     * Check if we're in a popup window
     */
    isPopup() {
      return window.opener && window.opener !== window;
    },

    /**
     * Send message to parent window
     */
    sendMessageToParent(message) {
      if (!window.opener) {
        console.warn('No parent window found');
        return;
      }

      // Send to same origin only for security
      window.opener.postMessage(message, window.location.origin);
    },
  },
};
</script>
