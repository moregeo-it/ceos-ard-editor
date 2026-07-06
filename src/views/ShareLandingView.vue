<template>
  <v-container class="fill-height">
    <v-row justify="center" align="center">
      <v-col cols="12" md="6" class="text-center">
        <v-card class="pa-8" elevation="4">
          <v-card-text>
            <template v-if="loading">
              <v-progress-circular indeterminate size="64" color="primary" class="mb-4" />
              <p class="text-body-1 text-medium-emphasis">Checking share link...</p>
            </template>

            <template v-else-if="preview">
              <v-icon size="64" color="primary" class="mb-4">{{ icons.share }}</v-icon>
              <h2 class="text-h5 mb-2">{{ preview.workspaceTitle }}</h2>
              <v-chip class="mb-6" size="small" color="primary" variant="tonal">
                {{ modeLabel(preview.mode) }}
              </v-chip>
              <p class="text-body-1 text-medium-emphasis mb-1">
                Shared by {{ preview.ownerDisplayName }}
              </p>
              <div v-if="!preview.isActive" class="mb-4">
                <v-alert type="warning" variant="tonal">
                  This share link is no longer active.
                </v-alert>
              </div>
              <v-btn
                v-else
                color="primary"
                size="large"
                :prepend-icon="icons.github"
                @click="continueWithGitHub"
              >
                Continue with GitHub
              </v-btn>
            </template>

            <template v-else-if="error">
              <v-icon size="64" color="error" class="mb-4">{{ icons.alert }}</v-icon>
              <h2 class="text-h5 mb-4">{{ error.title }}</h2>
              <v-alert type="error" variant="tonal" class="mb-4">{{ error.message }}</v-alert>
              <v-btn color="primary" @click="$router.push({ name: 'workspaces' })">
                Go to my workspaces
              </v-btn>
            </template>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { mdiAlertCircle, mdiGithub, mdiShareVariant } from '@mdi/js';
import { useAuthStore } from '@/stores/auth';
import { useShareStore } from '@/stores/share';

export default {
  name: 'ShareLandingView',

  data() {
    return {
      icons: {
        alert: mdiAlertCircle,
        github: mdiGithub,
        share: mdiShareVariant,
      },
      loading: true,
      preview: null,
      error: null,
    };
  },

  computed: {
    token() {
      return this.$route.params.token;
    },
    authStore() {
      return useAuthStore();
    },
    shareStore() {
      return useShareStore();
    },
  },

  async created() {
    await this.redeem();
  },

  methods: {
    modeLabel(mode) {
      const labels = {
        readonly: 'View only',
        comment: 'Can comment',
        edit: 'Can edit',
      };
      return labels[mode] || mode;
    },

    async redeem() {
      this.loading = true;
      try {
        const result = await this.shareStore.redeemShareLink(this.token);

        if (result.authenticated) {
          this.$router.replace({ name: 'editor', params: { id: result.workspace.id } });
          return;
        }

        this.preview = result.preview;
      } catch (err) {
        if (err.status === 403) {
          this.error = {
            title: 'Access revoked',
            message: 'Your access to this workspace was previously revoked by the owner.',
          };
        } else if (err.status === 404) {
          this.error = {
            title: 'Invalid link',
            message: 'This share link is invalid, expired, or no longer exists.',
          };
        } else {
          this.error = {
            title: 'Something went wrong',
            message: err.message || 'Failed to open this share link. Please try again.',
          };
        }
      } finally {
        this.loading = false;
      }
    },

    continueWithGitHub() {
      this.shareStore.setPendingShareToken(this.token);
      this.authStore.loginWithGitHub();
    },
  },
};
</script>
