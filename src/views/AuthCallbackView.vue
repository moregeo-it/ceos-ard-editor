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

        setTimeout(() => {
          this.$router.push({ name: 'landing' });
        }, 3000);
        return;
      }

      try {
        authStore.handleAuthCallback(searchParams);
        this.$router.push({ name: 'workspaces' });
      } catch (error) {
        const notifications = useNotificationsStore();
        notifications.error(`Authentication failed. Please try again. Error: ${error.message}`);
        this.$router.push({ name: 'landing' });
      }
    },
  },
};
</script>
