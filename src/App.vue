<script>
import { RouterView } from 'vue-router'

export default {
  name: 'App',
  components: {
    RouterView,
  },
}
</script>

<template>
  <v-app>
    <v-app-bar color="primary">
      <v-app-bar-title>CEOS-ARD Editor</v-app-bar-title>
    </v-app-bar>

    <v-main>
      <RouterView />
    </v-main>
  </v-app>
</template>
