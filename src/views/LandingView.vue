<template>
  <v-app>
    <v-main>
      <v-container fluid class="fill-height">
        <v-row justify="center">
          <v-col cols="12" md="10" lg="8" xl="7">
            <v-card elevation="0" class="pa-8 pa-md-12">
              <v-row align="center">
                <!-- Left side - Logo and branding -->
                <v-col cols="12" md="6" class="text-center text-md-left">
                  <!-- CEOS Logo -->
                  <div class="mb-6">
                    <img
                      :src="ceosLogo"
                      alt="CEOS Analysis Ready Data"
                      style="max-width: 200px; width: 100%; height: auto"
                    />
                  </div>

                  <h1 class="text-h4 font-weight-bold mb-3" style="color: var(--ceos-primary)">
                    CEOS-ARD Editor
                  </h1>

                  <p class="text-body-1 text-medium-emphasis">
                    Collaborative Product Specification Editor for<br class="d-none d-md-inline" />
                    CEOS Analysis Ready Data
                  </p>
                </v-col>

                <!-- Right side - Login buttons -->
                <v-col cols="12" md="6" class="d-flex flex-column align-center">
                  <div style="max-width: 360px; width: 100%">
                    <p class="text-h6 mb-6 text-center">Sign in to get started</p>

                    <LoginButton provider="github" @click="handleGitHubLogin" />
                  </div>
                </v-col>
              </v-row>
            </v-card>

            <!-- Footer -->
            <div class="text-center mt-8">
              <div class="d-flex justify-center align-center flex-wrap gap-2 mb-2">
                <v-btn
                  variant="text"
                  size="small"
                  :prepend-icon="icons.web"
                  href="https://ceos.org/ard/"
                  target="_blank"
                >
                  CEOS-ARD Website
                </v-btn>

                <v-divider vertical class="mx-2"></v-divider>

                <v-btn
                  variant="text"
                  size="small"
                  :prepend-icon="icons.github"
                  href="https://github.com/ceos-org"
                  target="_blank"
                >
                  CEOS GitHub Organization
                </v-btn>

                <v-divider vertical class="mx-2"></v-divider>

                <v-btn
                  variant="text"
                  size="small"
                  :prepend-icon="icons.web"
                  href="https://moregeo.it"
                  target="_blank"
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
                >
                  Imprint
                </v-btn>
              </div>
            </div>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script>
import { useAuthStore } from '@/stores/auth'
import LoginButton from '@/components/landing/LoginButton.vue'
import ceosLogo from '@/assets/ceos-ard-logo.png'
import { mdiGithub, mdiWeb, mdiFileDocument } from '@mdi/js'

export default {
  name: 'LandingView',

  components: {
    LoginButton,
  },

  data() {
    return {
      ceosLogo,
      icons: {
        github: mdiGithub,
        web: mdiWeb,
        document: mdiFileDocument,
      },
    }
  },

  methods: {
    handleGitHubLogin() {
      const authStore = useAuthStore()
      authStore.loginWithGitHub()
    },
  },
}
</script>
