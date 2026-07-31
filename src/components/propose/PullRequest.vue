<template>
  <div class="pull-request pa-4 fill-height overflow-auto">
    <div class="d-flex align-center mb-4">
      <h2 class="ma-0">
        <template v-if="proposal"
          >Proposal: <em>{{ proposal.title }}</em></template
        >
        <template v-else>Create Proposal</template>
      </h2>
      <v-chip v-if="proposal && proposal.draft" text="draft" class="ml-4" />
      <v-chip
        v-if="proposal && proposal.state"
        :text="proposal.state"
        :color="statusColor"
        class="ml-1"
      />
    </div>

    <div v-if="proposalStore.isProposalLoading" class="text-center">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <template v-else-if="commits.length > 0">
      <v-alert :type="statusColor" :icon="alertIcon" class="mt-4 mb-6" variant="tonal" dense>
        <!-- Must come first: a detached proposal also reports state 'closed', but it cannot
             be reopened, so it must not fall into the withdrawn/rejected branch below. -->
        <template v-if="isDetached">
          <p class="mb-2 font-weight-bold">
            Your fork was deleted on GitHub, so GitHub closed Pull Request #{{ proposal.number }}.
          </p>
          <p class="mb-2">
            None of your work is lost — every change is still in this workspace, and the fork is
            recreated automatically the next time you sync or commit. The Pull Request itself cannot
            be reopened, because GitHub permanently unlinks it from a deleted fork.
          </p>
          <p class="mb-2">
            Proposing again will open a <strong>new</strong> Pull Request with your title and
            description, linked back to the old one so its review comments stay reachable. Any other
            proposals you had open share the same fork and are affected in the same way.
          </p>

          <v-btn
            :href="proposal.url"
            target="_blank"
            rel="noopener noreferrer"
            color="primary"
            class="ma-2"
          >
            View Pull Request #{{ proposal.number }} on GitHub
          </v-btn>
        </template>
        <template v-else-if="proposal && proposal.state === 'open'">
          <p class="mb-2 font-weight-bold">
            A Pull Request has been created on GitHub for your proposed changes.
          </p>
          <p class="mb-2">
            Your Pull Request is in <strong>draft</strong> mode. To mark is as ready for review,
            please visit the Pull Request on GitHub and change its status there.
          </p>

          <v-btn
            :href="proposal.url"
            target="_blank"
            rel="noopener noreferrer"
            color="primary"
            class="ma-2"
          >
            View Pull Request on GitHub
          </v-btn>
          <v-btn
            class="ma-2"
            @click="changeState('closed')"
            color="error"
            :disabled="isChangingState"
            :loading="isChangingState"
            >Withdraw Proposal</v-btn
          >
        </template>
        <template v-else-if="proposal && proposal.state === 'closed'">
          <p class="mb-2 font-weight-bold">
            A Pull Request has been created on GitHub, but it has been withdrawn by you or was
            rejected by members of the CEOS-ARD community.
          </p>
          <p class="mb-2">
            You can try to reopen the Pull Request, but it might not be possible when rejected by a
            CEOS-ARD community. Please add a comment on the Pull Request on GitHub to discuss the
            reasons for rejection.
          </p>

          <v-btn
            :href="proposal.url"
            target="_blank"
            rel="noopener noreferrer"
            color="primary"
            class="ma-2"
          >
            View Pull Request on GitHub
          </v-btn>
          <v-btn
            class="ma-2"
            @click="changeState('open')"
            color="error"
            :disabled="isChangingState"
            :loading="isChangingState"
            >Reopen Proposal</v-btn
          >
        </template>
        <template v-else-if="proposal && proposal.state === 'merged'">
          <p class="mb-2 font-weight-bold">
            A Pull Request has been created on GitHub and it has been <strong>accepted</strong> by
            the CEOS-ARD community. Thank you for your contribution!
          </p>

          <v-btn
            :href="proposal.url"
            target="_blank"
            rel="noopener noreferrer"
            color="primary"
            class="ma-2"
          >
            View Pull Request on GitHub
          </v-btn>
        </template>
        <template v-else>
          You can propose your changes to CEOS-ARD now. This will create a new
          <em>Pull Request</em> on the CEOS-ARD GitHub repository. You can add more changes to the
          <em>Pull Request</em> later as well.
        </template>
      </v-alert>

      <v-form @submit.prevent="propose">
        <v-text-field
          v-model="title"
          required
          persistent-hint
          persistent-counter
          label="Title of the Proposal"
          hint="Specify a title for your overall proposal."
          variant="outlined"
          :counter="maxLengths.title"
          :disabled="formDisabled"
          class="mb-6"
        ></v-text-field>

        <v-textarea
          v-model="description"
          required
          persistent-hint
          persistent-counter
          label="Description of the Proposal"
          hint="Specify a detailed description for your overall proposal. You can use Markdown to format your description."
          variant="outlined"
          rows="8"
          :counter="maxLengths.description"
          :disabled="formDisabled"
          class="mb-4"
        ></v-textarea>

        <v-btn
          type="submit"
          color="primary"
          class="w-100"
          :disabled="formDisabled"
          :loading="isSubmitting"
        >
          <!-- "Update" would be a lie for a detached proposal: the old Pull Request is gone
               for good and submitting opens a replacement. -->
          <template v-if="isDetached">Create New</template>
          <template v-else-if="!proposal">Create</template>
          <template v-else>Update</template>
          Proposal
        </v-btn>
      </v-form>
    </template>
    <div v-else class="empty-state">
      <p class="text-subtle mt-4">
        You currently have no changes to propose.<br />
        Please make some changes in your workspace and commit them before creating a proposal.
      </p>
    </div>
  </div>
</template>

<script>
import { useProposalStore } from '@/stores/proposal';
import diffService from '@/services/proposal.service';
import { useWorkspacesStore } from '@/stores/workspaces';
import { useNotificationsStore } from '@/stores/notifications';
import {
  mdiInformation,
  mdiSourceBranch,
  mdiSourceBranchCheck,
  mdiSourceBranchRemove,
} from '@mdi/js';

export default {
  name: 'PullRequest',
  data() {
    return {
      isSubmitting: false,
      isChangingState: false,
      maxLengths: {
        title: 200,
        description: 10000,
      },
      icons: {
        opened: mdiSourceBranch,
        closed: mdiSourceBranchRemove,
        merged: mdiSourceBranchCheck,
        info: mdiInformation,
      },
    };
  },
  computed: {
    alertIcon() {
      if (this.proposal?.state) {
        return this.icons[this.proposal.state];
      }
      return mdiInformation;
    },
    // The fork this proposal was opened from has been deleted, so GitHub closed it and will
    // never let it reopen. Proposing again creates a new Pull Request instead.
    isDetached() {
      return Boolean(this.proposal?.detached);
    },
    statusColor() {
      if (this.isDetached) {
        return 'warning';
      }
      if (this.proposal) {
        switch (this.proposal.state) {
          case 'open':
            return 'success';
          case 'closed':
            return 'danger';
          case 'merged':
            return 'purple';
        }
      }
      return 'info';
    },
    workspace() {
      return this.workspacesStore.currentWorkspace;
    },
    workspacesStore() {
      return useWorkspacesStore();
    },
    notificationsStore() {
      return useNotificationsStore();
    },
    proposalStore() {
      return useProposalStore();
    },
    proposal() {
      return this.proposalStore.proposal;
    },
    diffs() {
      return this.proposalStore.diffList;
    },
    commits() {
      return this.proposalStore.commits || [];
    },
    formDisabled() {
      return (
        this.isSubmitting ||
        this.isChangingState ||
        // A detached proposal is also 'closed', but submitting is the whole recovery path:
        // it opens the replacement Pull Request. Disabling it would leave no way forward.
        (this.proposal && this.proposal.state === 'closed' && !this.isDetached) ||
        this.workspacesStore.isArchived
      );
    },
    title: {
      get() {
        return this.proposalStore.prTitle;
      },
      set(value) {
        this.proposalStore.prTitle = value;
      },
    },
    description: {
      get() {
        return this.proposalStore.prDescription;
      },
      set(value) {
        this.proposalStore.prDescription = value;
      },
    },
  },
  watch: {
    proposal: {
      immediate: true,
      handler(newProposal) {
        if (newProposal) {
          this.title = newProposal.title || '';
          this.description = newProposal.description || '';
        }
      },
    },
  },
  created() {
    if (!this.proposal) {
      if (this.title === null) {
        this.title = this.workspace.title || '';
      }
      if (this.description === null) {
        this.description = this.workspace.description || '';
      }
    }
  },
  methods: {
    async changeState(state) {
      this.isChangingState = true;
      try {
        const proposalInput = {
          title: this.proposal.title,
          description: this.proposal.description,
          state: state,
        };
        const pr = await diffService.propose(
          this.workspacesStore.currentWorkspace.id,
          proposalInput,
        );
        if (pr) {
          this.proposalStore.updateProposal(pr);
          this.notificationsStore.success('Proposal changed successfully.');
        }
        try {
          await this.workspacesStore.getWorkspace(this.workspace.id);
        } catch {
          this.notificationsStore.error('Failed to refresh workspace, please reload the page.');
        }
      } catch (error) {
        this.notificationsStore.error('Failed to change proposal state: ' + error.message);
      } finally {
        this.isChangingState = false;
      }
    },
    async propose() {
      if (this.formDisabled) return;
      const verb = this.proposal ? 'update' : 'create';
      this.isSubmitting = true;
      try {
        const proposalInput = {
          title: this.title,
          description: this.description,
        };
        const pr = await diffService.propose(
          this.workspacesStore.currentWorkspace.id,
          proposalInput,
        );
        if (pr) {
          this.proposalStore.updateProposal(pr);
          this.notificationsStore.success(`Proposal ${verb}d successfully.`);
        }
      } catch (error) {
        this.notificationsStore.error(`Failed to ${verb} proposal: ` + error.message);
      } finally {
        this.isSubmitting = false;
      }
    },
  },
};
</script>
