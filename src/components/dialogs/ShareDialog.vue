<template>
  <v-dialog v-model="show" :width="sizes.medium" scrollable>
    <v-card>
      <v-card-title>Share "{{ workspace.title }}"</v-card-title>

      <v-tabs v-model="tab">
        <v-tab value="people">People with access</v-tab>
        <v-tab value="link">Share link</v-tab>
      </v-tabs>

      <v-card-text style="max-height: 60vh">
        <v-tabs-window v-model="tab">
          <!-- People with access -->
          <v-tabs-window-item value="people">
            <v-form class="d-flex ga-2 align-start mt-2" @submit.prevent="sendInvite">
              <v-combobox
                v-model="inviteUsernames"
                label="GitHub username(s)"
                multiple
                chips
                closable-chips
                variant="outlined"
                density="compact"
                hide-details
                :disabled="isInviting"
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
              <v-btn
                type="submit"
                color="primary"
                :loading="isInviting"
                :disabled="inviteUsernames.length === 0"
              >
                Invite
              </v-btn>
            </v-form>

            <v-list class="mt-4">
              <v-list-item v-if="shareStore.isLoading">
                <v-progress-circular indeterminate size="24" color="primary" />
              </v-list-item>
              <v-list-item v-else-if="shares.length === 0">
                <span class="text-medium-emphasis">Not shared with anyone yet.</span>
              </v-list-item>
              <v-list-item v-for="share in shares" :key="share.id">
                <template v-slot:prepend>
                  <v-icon :icon="icons.account" />
                </template>
                <v-list-item-title>{{ share.invitedGithubUsername }}</v-list-item-title>
                <v-list-item-subtitle>
                  <v-chip size="x-small" :color="statusColor(share.status)" variant="tonal">
                    {{ share.status }}
                  </v-chip>
                </v-list-item-subtitle>
                <template v-slot:append>
                  <v-select
                    :model-value="share.mode"
                    :items="modeOptions"
                    density="compact"
                    hide-details
                    variant="underlined"
                    style="max-width: 130px"
                    class="mr-2"
                    :disabled="share.status === 'revoked' || shareStore.isMutating"
                    @update:model-value="(mode) => changeShareMode(share, mode)"
                  />
                  <v-btn
                    icon
                    variant="text"
                    size="small"
                    :disabled="shareStore.isMutating"
                    @click="removeShare(share)"
                  >
                    <v-icon :icon="icons.close" />
                  </v-btn>
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
              <v-btn type="submit" color="primary" :loading="isCreatingLink"> Create link </v-btn>
            </v-form>

            <v-list class="mt-4">
              <v-list-item v-if="shareStore.isLoading">
                <v-progress-circular indeterminate size="24" color="primary" />
              </v-list-item>
              <v-list-item v-else-if="shareLinks.length === 0">
                <span class="text-medium-emphasis">No share links created yet.</span>
              </v-list-item>
              <v-list-item v-for="link in shareLinks" :key="link.id">
                <v-list-item-title class="text-truncate">{{ link.url }}</v-list-item-title>
                <v-list-item-subtitle>
                  <v-chip size="x-small" color="primary" variant="tonal" class="mr-1">
                    {{ modeLabel(link.mode) }}
                  </v-chip>
                  <span v-if="link.expiresAt">Expires {{ formatDate(link.expiresAt) }}</span>
                  <span v-else>Never expires</span>
                </v-list-item-subtitle>
                <template v-slot:append>
                  <v-switch
                    :model-value="link.isActive"
                    color="primary"
                    density="compact"
                    hide-details
                    class="mr-2"
                    :disabled="shareStore.isMutating"
                    @update:model-value="(active) => toggleLinkActive(link, active)"
                  />
                  <v-btn icon variant="text" size="small" @click="copyLink(link)">
                    <v-icon :icon="icons.copy" />
                  </v-btn>
                  <v-btn
                    icon
                    variant="text"
                    size="small"
                    :disabled="shareStore.isMutating"
                    @click="deleteLink(link)"
                  >
                    <v-icon :icon="icons.delete" />
                  </v-btn>
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
      inviteMode: 'edit',
      isInviting: false,
      linkMode: 'edit',
      isCreatingLink: false,
      modeOptions: [
        { title: 'Can edit', value: 'edit' },
        { title: 'Can comment', value: 'comment' },
        { title: 'View only', value: 'readonly' },
      ],
    };
  },

  computed: {
    shareStore() {
      return useShareStore();
    },
    notificationsStore() {
      return useNotificationsStore();
    },
    shares() {
      return this.shareStore.shares;
    },
    shareLinks() {
      return this.shareStore.shareLinks;
    },
  },

  created() {
    this.loadData();
  },

  methods: {
    async loadData() {
      try {
        await Promise.all([
          this.shareStore.fetchShares(this.workspace.id),
          this.shareStore.fetchShareLinks(this.workspace.id),
        ]);
      } catch (error) {
        this.notificationsStore.error(`Failed to load sharing info: ${error.message}`);
      }
    },

    modeLabel(mode) {
      return this.modeOptions.find((option) => option.value === mode)?.title || mode;
    },

    statusColor(status) {
      return { accepted: 'success', pending: 'warning', revoked: 'grey' }[status] || 'grey';
    },

    formatDate(dateString) {
      return new Date(dateString).toLocaleString();
    },

    async sendInvite() {
      if (this.inviteUsernames.length === 0) return;

      this.isInviting = true;
      try {
        await this.shareStore.createShares(
          this.workspace.id,
          this.inviteUsernames,
          this.inviteMode,
        );
        this.notificationsStore.success('Invitation sent successfully');
        this.inviteUsernames = [];
      } catch (error) {
        this.notificationsStore.error(`Failed to invite: ${error.message}`);
      } finally {
        this.isInviting = false;
      }
    },

    async changeShareMode(share, mode) {
      try {
        await this.shareStore.updateShare(this.workspace.id, share.id, mode);
      } catch (error) {
        this.notificationsStore.error(`Failed to update access: ${error.message}`);
      }
    },

    async removeShare(share) {
      try {
        await this.shareStore.revokeShare(this.workspace.id, share.id);
        this.notificationsStore.success(`Removed access for ${share.invitedGithubUsername}`);
      } catch (error) {
        this.notificationsStore.error(`Failed to remove access: ${error.message}`);
      }
    },

    async createLink() {
      this.isCreatingLink = true;
      try {
        await this.shareStore.createShareLink(this.workspace.id, this.linkMode);
        this.notificationsStore.success('Share link created');
      } catch (error) {
        this.notificationsStore.error(`Failed to create share link: ${error.message}`);
      } finally {
        this.isCreatingLink = false;
      }
    },

    async toggleLinkActive(link, isActive) {
      try {
        await this.shareStore.updateShareLink(this.workspace.id, link.id, { isActive });
      } catch (error) {
        this.notificationsStore.error(`Failed to update share link: ${error.message}`);
      }
    },

    async deleteLink(link) {
      try {
        await this.shareStore.deleteShareLink(this.workspace.id, link.id);
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
