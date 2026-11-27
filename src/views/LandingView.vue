<template>
  <v-main>
    <v-container fluid class="fill-height flex-column">
      <v-row justify="center" class="flex-grow-0">
        <v-col>
          <v-alert type="warning">{{ notice }}</v-alert>
        </v-col>
      </v-row>
      <v-row justify="center" align="center" class="flex-grow-1 w-100">
        <v-col cols="12" md="10" lg="8" xl="7">
          <v-card elevation="0" class="pa-8 pa-md-12">
            <v-row align="center">
              <!-- Left side - Logo and branding -->
              <v-col cols="12" md="6" class="text-center">
                <img v-if="logo" :src="logo" :alt="appTitle" class="logo mb-6" />

                <h1 class="text-h4 font-weight-bold mb-3">{{ appTitle }}</h1>

                <p class="text-body-1 text-medium-emphasis">{{ appSubtitle }}</p>
              </v-col>

              <!-- Right side - Login buttons -->
              <v-col cols="12" md="6" class="d-flex flex-column align-center">
                <p class="text-h6 mb-6 text-center">Sign in to get started</p>

                <LoginButton @click="handleGitHubLogin" />
              </v-col>
            </v-row>
          </v-card>

          <!-- Footer -->
          <div class="text-center mt-8">
            <div class="d-flex justify-center align-center flex-wrap gap-2 mb-2">
              <template v-for="link in links" :key="link.url">
                <v-btn
                  variant="text"
                  size="small"
                  :prepend-icon="link.url.includes('github.com') ? icons.github : icons.web"
                  :href="link.url"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ link.title }}
                </v-btn>

                <v-divider vertical class="mx-2"></v-divider>
              </template>

              <v-btn
                variant="text"
                size="small"
                :prepend-icon="icons.web"
                href="https://moregeo.it"
                target="_blank"
                rel="noopener noreferrer"
              >
                MoreGeo GmbH
              </v-btn>

              <v-divider vertical class="mx-2"></v-divider>

              <v-btn
                variant="text"
                size="small"
                :prepend-icon="icons.document"
                href="https://moregeo.it/imprint"
                target="_blank"
                rel="noopener noreferrer"
              >
                Imprint
              </v-btn>
            </div>
          </div>
        </v-col>
      </v-row>
    </v-container>
  </v-main>
</template>

<script>
import { useAuthStore } from '@/stores/auth';
import LoginButton from '@/components/landing/LoginButton.vue';
import ceosLogo from '@/assets/ceos-ard-logo.png';
import { APP_LINKS, APP_LOGO, APP_NOTICE, APP_SUBTITLE, APP_TITLE } from '@/utils/branding';
import { mdiGithub, mdiWeb, mdiFileDocument } from '@mdi/js';

export default {
  name: 'LandingView',

  components: {
    LoginButton,
  },

  data() {
    return {
      appTitle: APP_TITLE,
      appSubtitle: APP_SUBTITLE,
      notice: APP_NOTICE,
      logo: APP_LOGO === 'none' ? null : APP_LOGO || ceosLogo,
      links: APP_LINKS,
      icons: {
        github: mdiGithub,
        web: mdiWeb,
        document: mdiFileDocument,
      },
    };
  },

  methods: {
    handleGitHubLogin() {
      const authStore = useAuthStore();
      authStore.loginWithGitHub();
    },
  },
};
</script>

<style scoped>
h1 {
  color: var(--ceos-primary);
}
@media (prefers-color-scheme: dark) {
  h1 {
    color: white;
  }
}
.logo {
  max-width: 200px;
  width: 100%;
  height: auto;
}
</style>
