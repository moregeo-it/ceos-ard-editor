<template>
  <v-dialog :model-value="show" persistent max-width="600">
    <v-card>
      <v-card-title class="text-h5 d-flex align-center">
        <v-icon color="warning" :icon="icons.clockAlert" start class="mr-2" />
        Session Expired
      </v-card-title>

      <v-card-text class="pt-4">
        <v-alert v-if="popupBlocked" type="error" variant="tonal" class="mb-4">
          <div class="text-subtitle-2 mb-2">Popup Blocked</div>
          <p class="text-body-2 mb-2">
            Your browser blocked the authentication window. To continue:
          </p>
          <ol class="text-body-2 mb-0 pl-4">
            <li>Click the popup icon in your address bar</li>
            <li>Allow popups for this site</li>
            <li>Click one of the buttons below to try again</li>
          </ol>
        </v-alert>

        <p class="text-body-1 mb-3">
          Your session has expired. Please reauthenticate to continue working.
        </p>

        <v-alert v-if="unsavedChanges > 0" type="info" variant="tonal" density="compact">
          <v-icon size="small" :icon="icons.contentSave" class="mr-2" />
          You have
          <strong>{{ unsavedChanges }} unsaved change{{ unsavedChanges > 1 ? 's' : '' }}</strong>
        </v-alert>

        <p class="text-body-2 text-medium-emphasis mt-3">
          Your unsaved work will be preserved during authentication.
        </p>
      </v-card-text>

      <v-card-actions class="px-6 pb-4">
        <v-btn color="error" variant="text" :disabled="isAuthenticating" @click="handleCancel">
          Logout
        </v-btn>

        <v-spacer />

        <v-btn
          color="primary"
          variant="elevated"
          :prepend-icon="icons.github"
          size="large"
          :loading="isAuthenticating"
          @click="handleReauthenticate"
        >
          Reauthenticate with GitHub
        </v-btn>
      </v-card-actions>

      <v-progress-linear v-if="isAuthenticating" indeterminate color="primary" />
    </v-card>
  </v-dialog>
</template>

<script>
import { useAuthStore } from '@/stores/auth';
import { useEditorStore } from '@/stores/editor';
import { useNotificationsStore } from '@/stores/notifications';
import authService from '@/services/auth.service';
import { mdiClockAlertOutline, mdiContentSaveAlert, mdiGithub } from '@mdi/js';

export default {
  name: 'ReauthenticationDialog',

  props: {
    show: {
      type: Boolean,
      required: true,
    },
  },

  data() {
    return {
      isAuthenticating: false,
      popupBlocked: false,
      icons: {
        clockAlert: mdiClockAlertOutline,
        contentSave: mdiContentSaveAlert,
        github: mdiGithub,
      },
    };
  },

  computed: {
    authStore() {
      return useAuthStore();
    },

    editorStore() {
      return useEditorStore();
    },

    notificationsStore() {
      return useNotificationsStore();
    },

    unsavedChanges() {
      return this.editorStore.opened.filter((file) => this.editorStore.changed[file.path]).length;
    },
  },

  methods: {
    async handleReauthenticate() {
      this.isAuthenticating = true;
      this.popupBlocked = false;

      try {
        // Attempt popup authentication with GitHub
        const authData = await authService.reauthenticateWithPopup('github');

        // Success - update auth store
        this.authStore.updateAuthAfterReauth(authData);
        this.notificationsStore.success('Successfully reauthenticated');

        // Reset state
        this.isAuthenticating = false;
      } catch (error) {
        this.isAuthenticating = false;

        if (error.message === 'POPUP_BLOCKED') {
          // Show popup blocked message
          this.popupBlocked = true;
          this.notificationsStore.warning('Please allow popups for this site');
        } else if (error.message === 'POPUP_CLOSED') {
          // User closed popup - just clear state
          this.notificationsStore.info('Authentication cancelled');
        } else {
          // Other error
          this.notificationsStore.error('Reauthentication failed: ' + error.message);
        }
      }
    },

    handleCancel() {
      const confirmed = confirm(
        'Are you sure you want to logout?\n\n' +
          (this.unsavedChanges > 0
            ? `You will lose ${this.unsavedChanges} unsaved change${this.unsavedChanges > 1 ? 's' : ''}.`
            : 'You will be redirected to the login page.'),
      );

      if (confirmed) {
        this.authStore.logout();
      }
    },
  },
};
</script>
