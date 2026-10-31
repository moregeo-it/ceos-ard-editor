<template>
  <v-dialog v-model="show" width="800" scrollable>
    <v-card>
      <v-card-title>Share "{{ workspace.title }}"</v-card-title>
      <v-card-subtitle>Manage who can access this workspace.</v-card-subtitle>

      <v-tabs v-model="tab" class="flex-shrink-0">
        <v-tab value="people">People with access</v-tab>
        <v-tab value="link">Share a link</v-tab>
      </v-tabs>

      <v-card-text style="height: 400px">
        <v-tabs-window v-model="tab">
          <!-- People with access -->
          <v-tabs-window-item value="people">
            <v-form class="d-flex ga-2 align-start mt-2" @submit.prevent="sendInvite">
              <!-- Enter sends (the combobox blocks the form's submit); a comma or space adds a chip -->
              <v-combobox
                v-model="inviteUsernames"
                v-model:search="inviteSearch"
                label="GitHub username(s)"
                multiple
                chips
                closable-chips
                :delimiters="[',', ' ']"
                variant="outlined"
                density="compact"
                hide-details
                :disabled="isInviting"
                @keyup.enter="sendInvite"
              />
              <v-select
                v-model="inviteMode"
                :items="modeOptions"
                label="Access"
                variant="outlined"
                density="compact"
                hide-details
                style="max-width: 160px"
                :disabled="isInviting"
              />
              <v-btn type="submit" color="primary" :loading="isInviting" :disabled="!canInvite">
                Invite
              </v-btn>
            </v-form>
            <p class="text-body-2 text-medium-emphasis mt-3 mb-0">
              Type a GitHub username and press Enter or Invite. To invite several people at once,
              separate their usernames with commas or spaces.
            </p>

            <v-list class="mt-4">
              <v-list-item v-if="shareStore.isLoadingCollaborators">
                <v-progress-linear indeterminate size="24" color="primary" />
              </v-list-item>
              <v-list-item v-else-if="collaborators.length === 0">
                <span class="text-medium-emphasis">Not shared with anyone yet.</span>
              </v-list-item>
              <v-list-item v-for="share in collaborators" :key="share.id">
                <template v-slot:prepend>
                  <v-icon :icon="icons.account" />
                </template>
                <v-list-item-title>{{ share.invitee_github_username }}</v-list-item-title>
                <v-list-item-subtitle>
                  <span v-if="share.id in removals">Access removed</span>
                  <v-chip v-else size="x-small" :color="statusColor(share.status)" variant="tonal">
                    {{ share.status }}
                  </v-chip>
                </v-list-item-subtitle>
                <template v-slot:append>
                  <v-btn
                    v-if="share.id in removals"
                    variant="flat"
                    color="primary"
                    :disabled="!removals[share.id]"
                    @click="undoRemoval(share)"
                  >
                    Undo
                  </v-btn>
                  <template v-else>
                    <v-select
                      :model-value="share.mode"
                      :items="modeOptions"
                      density="compact"
                      hide-details
                      variant="underlined"
                      style="max-width: 150px"
                      class="mr-2"
                      :disabled="shareStore.isMutating"
                      @update:model-value="(mode) => changeShareMode(share, mode)"
                    />
                    <v-tooltip text="Remove access" location="top">
                      <template v-slot:activator="{ props }">
                        <v-btn
                          v-bind="props"
                          icon
                          :aria-label="`Remove access for ${share.invitee_github_username}`"
                          variant="text"
                          size="small"
                          :disabled="shareStore.isMutating"
                          @click="removeShare(share)"
                        >
                          <v-icon :icon="icons.close" />
                        </v-btn>
                      </template>
                    </v-tooltip>
                  </template>
                </template>
              </v-list-item>
            </v-list>
          </v-tabs-window-item>

          <!-- Share link -->
          <v-tabs-window-item value="link">
            <v-form class="d-flex ga-2 align-start mt-2" @submit.prevent="createLink">
              <v-select
                v-model="linkMode"
                :items="modeOptions"
                label="Access"
                density="compact"
                hide-details
                style="max-width: 160px"
                :disabled="isCreatingLink"
                variant="outlined"
              />
              <v-btn
                type="submit"
                color="primary"
                :loading="isCreatingLink"
                :disabled="shareStore.isLoadingShares"
              >
                Create link
              </v-btn>
            </v-form>
            <p class="text-body-2 text-medium-emphasis mt-3 mb-0">
              You can manage invite links here. Anyone with a GitHub account can join using an
              invite link and will receive the permissions assigned to that link.<br /><br />
              Deleting an invite link stops new people from joining, but people who already joined
              keep their access until you remove them under “People with access”. Someone you remove
              can join again through an invite link that still exists, so delete that link too.
            </p>

            <v-list class="mt-4">
              <v-list-item v-if="shareStore.isLoadingShares">
                <v-progress-circular indeterminate size="24" color="primary" />
              </v-list-item>
              <v-list-item v-else-if="shares.length === 0">
                <span class="text-medium-emphasis">No share links created yet.</span>
              </v-list-item>
              <v-list-item v-for="link in shares" :key="link.id">
                <v-list-item-title class="text-truncate">{{ link.url }}</v-list-item-title>
                <v-list-item-subtitle>
                  <v-chip size="x-small" color="primary" variant="tonal" class="mr-1">
                    {{ modeLabel(link.mode) }}
                  </v-chip>
                  <span v-if="link.expires_at">Expires {{ formatDate(link.expires_at) }}</span>
                  <span v-else>Never expires</span>
                </v-list-item-subtitle>
                <template v-slot:append>
                  <v-tooltip text="Copy link" location="top">
                    <template v-slot:activator="{ props }">
                      <v-btn
                        v-bind="props"
                        icon
                        aria-label="Copy share link"
                        variant="text"
                        size="small"
                        @click="copyLink(link)"
                      >
                        <v-icon :icon="icons.copy" />
                      </v-btn>
                    </template>
                  </v-tooltip>
                  <v-tooltip text="Delete link" location="top">
                    <template v-slot:activator="{ props }">
                      <v-btn
                        v-bind="props"
                        icon
                        aria-label="Delete share link"
                        variant="text"
                        size="small"
                        :disabled="shareStore.isMutating"
                        @click="deleteLink(link)"
                      >
                        <v-icon :icon="icons.delete" />
                      </v-btn>
                    </template>
                  </v-tooltip>
                </template>
              </v-list-item>
            </v-list>
          </v-tabs-window-item>
        </v-tabs-window>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn @click="reject">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { mdiAccountCircle, mdiClose, mdiContentCopy, mdiDelete } from '@mdi/js';
import DialogMixin from '@/components/DialogMixin';
import { useShareStore } from '@/stores/share';
import { useNotificationsStore } from '@/stores/notifications';
import { ACCESS_MODES, shareModeLabel } from '@/utils/shareMode';

// How long a removal can be undone before it is sent
const UNDO_SECONDS = 10;

export default {
  name: 'ShareDialog',
  mixins: [DialogMixin],

  props: {
    workspace: {
      type: Object,
      required: true,
    },
  },

  data() {
    return {
      icons: {
        account: mdiAccountCircle,
        close: mdiClose,
        copy: mdiContentCopy,
        delete: mdiDelete,
      },
      tab: 'people',
      inviteUsernames: [],
      inviteSearch: '',
      inviteMode: 'readonly',
      isInviting: false,
      linkMode: 'readonly',
      isCreatingLink: false,
      modeOptions: ACCESS_MODES,
      // Collaborator id -> timer of a removal that can still be undone, null once it is being sent
      removals: {},
    };
  },

  computed: {
    shareStore() {
      return useShareStore();
    },
    notificationsStore() {
      return useNotificationsStore();
    },
    collaborators() {
      return this.shareStore.collaborators;
    },
    shares() {
      return this.shareStore.shares;
    },
    // The chips and the name still being typed
    invitees() {
      return [...new Set([...this.inviteUsernames, this.inviteSearch?.trim()].filter(Boolean))];
    },
    canInvite() {
      return (
        this.invitees.length > 0 && !this.isInviting && !this.shareStore.isLoadingCollaborators
      );
    },
  },

  created() {
    this.loadData();
    window.addEventListener('pagehide', this.sendRemovalsOnPageHide);
  },

  beforeUnmount() {
    window.removeEventListener('pagehide', this.sendRemovalsOnPageHide);
    this.sendRemovals();
  },

  methods: {
    async loadData() {
      this.shareStore.setActiveWorkspace(this.workspace.id);
      try {
        await Promise.all([
          this.shareStore.fetchCollaborators(this.workspace.id),
          this.shareStore.fetchShares(this.workspace.id),
        ]);
      } catch (error) {
        this.notificationsStore.error(`Failed to load sharing info: ${error.message}`);
      }
    },

    modeLabel(mode) {
      return shareModeLabel(mode);
    },

    statusColor(status) {
      return { accepted: 'success', pending: 'warning' }[status] || 'grey';
    },

    formatDate(dateString) {
      return new Date(dateString).toLocaleString();
    },

    async sendInvite() {
      if (!this.canInvite) return;

      this.isInviting = true;
      try {
        const added = await this.shareStore.addCollaborators(
          this.workspace.id,
          this.invitees,
          this.inviteMode,
        );
        // Invited again before the removal was sent: keep them
        added?.forEach((collaborator) => this.undoRemoval(collaborator));
        this.notificationsStore.success('Invitation sent successfully');
        this.inviteUsernames = [];
        this.inviteSearch = '';
      } catch (error) {
        this.notificationsStore.error(`Failed to invite: ${error.message}`);
      } finally {
        this.isInviting = false;
      }
    },

    async changeShareMode(share, mode) {
      try {
        await this.shareStore.updateCollaborator(this.workspace.id, share.id, mode);
      } catch (error) {
        this.notificationsStore.error(`Failed to update access: ${error.message}`);
      }
    },

    removeShare(share) {
      this.removals[share.id] = setTimeout(() => this.sendRemoval(share), UNDO_SECONDS * 1000);
    },

    undoRemoval(share) {
      if (this.removals[share.id]) {
        clearTimeout(this.removals[share.id]);
        delete this.removals[share.id];
      }
    },

    async sendRemoval(share, options) {
      clearTimeout(this.removals[share.id]);
      this.removals[share.id] = null;
      try {
        await this.shareStore.revokeCollaborator(this.workspace.id, share.id, options);
        this.notificationsStore.success(`Removed access for ${share.invitee_github_username}`);
      } catch (error) {
        this.notificationsStore.error(`Failed to remove access: ${error.message}`);
      } finally {
        delete this.removals[share.id];
      }
    },

    // The dialog closes or the page goes away: no time left to undo
    sendRemovals(options) {
      this.collaborators
        .filter((share) => this.removals[share.id])
        .forEach((share) => this.sendRemoval(share, options));
    },

    sendRemovalsOnPageHide() {
      // keepalive: the request outlives the page
      this.sendRemovals({ keepalive: true });
    },

    async createLink() {
      this.isCreatingLink = true;
      try {
        await this.shareStore.createShare(this.workspace.id, this.linkMode);
        this.notificationsStore.success('Share link created');
      } catch (error) {
        this.notificationsStore.error(`Failed to create share link: ${error.message}`);
      } finally {
        this.isCreatingLink = false;
      }
    },

    async deleteLink(link) {
      try {
        await this.shareStore.deleteShare(this.workspace.id, link.id);
        this.notificationsStore.success('Share link deleted');
      } catch (error) {
        this.notificationsStore.error(`Failed to delete share link: ${error.message}`);
      }
    },

    async copyLink(link) {
      try {
        await navigator.clipboard.writeText(link.url);
        this.notificationsStore.success('Link copied to clipboard');
      } catch {
        this.notificationsStore.error('Failed to copy link');
      }
    },
  },
};
</script>
