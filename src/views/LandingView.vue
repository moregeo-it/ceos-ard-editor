<script>
import { useAuthStore } from '@/stores/auth'
import LoginButton from '@/components/landing/LoginButton.vue'
import ceosLogo from '@/assets/ceos-ard-logo.png'

export default {
  name: 'LandingView',
  
  components: {
    LoginButton
  },
  
  data() {
    return {
      ceosLogo
    }
  },
  
  methods: {
    handleGitHubLogin() {
      const authStore = useAuthStore()
      authStore.loginWithGitHub()
    },
    
    handleGoogleLogin() {
      const authStore = useAuthStore()
      authStore.loginWithGoogle()
    }
  }
}
</script>

<template>
  <v-app>
    <v-main>
      <v-container fluid class="fill-height">
        <v-row justify="center" align="center">
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
                      style="max-width: 200px; width: 100%; height: auto;"
                    />
                  </div>
                  
                  <h1 class="text-h4 font-weight-bold mb-3" style="color: #3e5265;">
                    CEOS-ARD Editor
                  </h1>
                  
                  <p class="text-body-1 text-medium-emphasis">
                    Collaborative Product Specification editor for<br class="d-none d-md-inline">
                    CEOS Analysis Ready Data
                  </p>
                </v-col>
                
                <!-- Right side - Login buttons -->
                <v-col cols="12" md="6" class="d-flex flex-column align-center">
                  <div style="max-width: 360px; width: 100%;">
                    <p class="text-h6 mb-6 text-center">
                      Sign in to get started
                    </p>
                    
                    <LoginButton
                      provider="github"
                      class="mb-4"
                      @click="handleGitHubLogin"
                    />
                    
                    <LoginButton
                      provider="google"
                      @click="handleGoogleLogin"
                    />
                  </div>
                </v-col>
              </v-row>
            </v-card>
            
            <!-- Footer -->
            <div class="text-center mt-8">
              <p class="text-caption text-medium-emphasis">
                © {{ new Date().getFullYear() }} CEOS-ARD Editor · Licensed under Apache License 2.0
              </p>
            </div>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<style scoped>
.fill-height {
  min-height: 100vh;
}
</style>