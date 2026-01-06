<template>
  <v-app>
    <!-- Top Navigation Bar -->
    <v-app-bar color="primary" elevation="2">
      <!-- Workspace Name -->
      <v-app-bar-title>
        {{ workspace?.title || 'Loading...' }}
      </v-app-bar-title>

      <!-- Action Buttons -->
      <v-btn
        v-if="!isArchived"
        variant="flat"
        color="success"
        class="mr-2"
        :prepend-icon="icons.propose"
        @click="handlePropose"
        :disabled="loading"
      >
        Propose
      </v-btn>

      <v-btn
        variant="flat"
        color="error"
        class="mr-4"
        :prepend-icon="icons.close"
        @click="goToWorkspaces"
      >
        Close
      </v-btn>

      <v-spacer />

      <!-- User Menu -->
      <v-menu v-model="showUserMenu" location="bottom end">
        <template v-slot:activator="{ props }">
          <v-btn v-bind="props" variant="text" :prepend-icon="icons.accountCircle">
            {{ authStore.username }}
            <v-icon :icon="icons.menuDown" />
          </v-btn>
        </template>

        <v-list>
          <v-list-item @click="handleLogout">
            <template v-slot:prepend>
              <v-icon :icon="icons.logout" />
            </template>
            <v-list-item-title>Logout</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-app-bar>

    <!-- Main Content Area -->
    <v-main>
      <v-container v-if="loading" class="fill-height d-flex align-center justify-center">
        <v-progress-circular indeterminate color="primary" size="64" />
      </v-container>
      <splitpanes @resized="storePaneSizes" :dbl-click-splitter="false">
        <pane class="files" min-size="10" :size="panelSizes.files">
          <FilesPane />
        </pane>
        <pane class="editor" min-size="30" :size="panelSizes.editor">
          <EditorPane>
            <template #message>
              <!-- Archived Workspace Banner -->
              <v-alert
                v-if="isArchived"
                type="warning"
                variant="tonal"
                prominent
                class="mb-4"
                :icon="icons.alert"
              >
                <v-alert-title>This workspace is archived (Read-Only)</v-alert-title>
                <div class="mt-2">
                  You are viewing this workspace in read-only mode.
                  <strong>Activate it to make changes or propose updates.</strong>
                </div>
                <template v-if="workspace?.deletion_at">
                  <div class="mt-2 text-caption">
                    Scheduled for deletion on:
                    <strong>{{ new Date(workspace.deletion_at).toLocaleDateString() }}</strong>
                  </div>
                </template>
                <template v-slot:append>
                  <v-btn
                    color="success"
                    variant="elevated"
                    :prepend-icon="icons.activate"
                    @click="handleToggleStatus"
                    :loading="isToggling"
                  >
                    Activate Now
                  </v-btn>
                </template>
              </v-alert>
            </template>
          </EditorPane>
        </pane>
        <pane class="preview" min-size="0" :size="panelSizes.preview">
          <PreviewPane />
        </pane>
      </splitpanes>
    </v-main>
  </v-app>
</template>

<script>
import { useAuthStore } from '@/stores/auth'
import { useWorkspacesStore } from '@/stores/workspaces'
import { useNotificationsStore } from '@/stores/notifications'
import {
  mdiAccountCircle,
  mdiLogout,
  mdiCheckCircle,
  mdiMenuDown,
  mdiAlert,
  mdiPackageUp,
  mdiClose,
} from '@mdi/js'
import EditorPane from '@/components/ide/EditorPane.vue'
import FilesPane from '@/components/ide/FilesPane.vue'
import PreviewPane from '@/components/ide/PreviewPane.vue'
import { Splitpanes, Pane } from 'splitpanes'

export default {
  name: 'EditorView',
  components: {
    EditorPane,
    FilesPane,
    Pane,
    PreviewPane,
    Splitpanes,
  },

  data() {
    const panelSizeDefaults = {
      files: 20,
      editor: 45,
      preview: 35,
    }
    return {
      icons: {
        accountCircle: mdiAccountCircle,
        logout: mdiLogout,
        propose: mdiCheckCircle,
        menuDown: mdiMenuDown,
        activate: mdiPackageUp,
        alert: mdiAlert,
        close: mdiClose,
      },
      showUserMenu: false,
      workspace: null,
      loading: true,
      isToggling: false,
      panelSizeDefaults: panelSizeDefaults,
      panelSizes: {
        files: localStorage.filesPanelSize ?? panelSizeDefaults.files,
        editor: localStorage.editorPanelSize ?? panelSizeDefaults.editor,
        preview: localStorage.previewPanelSize ?? panelSizeDefaults.preview,
      },
    }
  },

  computed: {
    authStore() {
      return useAuthStore()
    },

    workspacesStore() {
      return useWorkspacesStore()
    },

    notificationsStore() {
      return useNotificationsStore()
    },

    workspaceId() {
      return this.$route.params.id
    },

    isArchived() {
      return this.workspace?.status === 'archived'
    },
  },

  async mounted() {
    await this.loadWorkspace()
  },

  methods: {
    storePaneSizes: ({ panes }) => {
      if (panes.length === 3) {
        localStorage.filesPanelSize = panes[0].size
        localStorage.editorPanelSize = panes[1].size
        localStorage.previewPanelSize = panes[2].size
      }
    },

    async loadWorkspace() {
      try {
        this.loading = true
        this.workspace = await this.workspacesStore.getWorkspace(this.workspaceId)
      } catch (error) {
        console.error('Failed to load workspace:', error)
        this.notificationsStore.error(`Failed to load workspace: ${error.message}`)
        this.$router.push({ name: 'workspaces' })
      } finally {
        this.loading = false
      }
    },

    async handleToggleStatus() {
      this.isToggling = true
      try {
        await this.workspacesStore.toggleWorkspaceStatus(this.workspaceId)
        // Reload workspace to get updated status
        this.workspace = await this.workspacesStore.getWorkspace(this.workspaceId)
        this.notificationsStore.success('Workspace activated successfully')
      } catch (error) {
        console.error('Failed to toggle workspace status:', error)
        this.notificationsStore.error(`Failed to activate workspace: ${error.message}`)
      } finally {
        this.isToggling = false
      }
    },

    handlePropose() {
      // TODO: Implement propose functionality
      console.log('Propose workspace:', this.workspaceId)
    },

    async handleLogout() {
      try {
        await this.authStore.logout()
        this.notificationsStore.success('Successfully logged out')
        this.$router.push({ name: 'landing' })
      } catch {
        // Even if logout fails on backend, we still clear local auth
        // Just notify user there might have been an issue
        if (this.authStore.error) {
          this.notificationsStore.warning('Logged out locally. Server logout may have failed.')
        }
        this.$router.push({ name: 'landing' })
      }
    },

    goToWorkspaces() {
      this.$router.push({ name: 'workspaces' })
    },
  },
}
</script>

<style>
@import '../../node_modules/splitpanes/dist/splitpanes.css';

.splitpanes .splitpanes__splitter {
  background-color: #cccccc;
  min-width: 4px;
}

.splitpanes .splitpanes__splitter:hover,
.splitpanes .splitpanes__splitter:active,
.splitpanes .splitpanes__splitter:focus {
  background-color: #aaaaaa;
}
</style>

<style scoped>
.files {
  background-color: #f5f5f5;
  overflow: auto;
}
.editor {
  overflow: auto;
}
.preview {
  overflow: auto;
}
</style>
