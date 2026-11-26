<template>
  <v-dialog v-model="show" :max-width="sizes.medium">
    <v-form ref="form" @submit.prevent="handleSubmit">
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon :icon="dialogIcon" start></v-icon>
          {{ dialogTitle }}
        </v-card-title>

        <v-divider></v-divider>

        <v-card-text class="pt-6">
          <v-select
            v-if="!isUpdateMode && typesStore.hasMultipleTypes"
            v-model="formData.type"
            :items="typesStore.availableTypes"
            item-title="title"
            item-value="id"
            label="What do you want to edit?"
            variant="outlined"
            :prepend-inner-icon="icons.type"
            class="mb-3"
          >
            <template #item="{ props, item }">
              <v-list-item v-bind="props" :subtitle="item.raw.description" />
            </template>
          </v-select>

          <template v-if="!isUpdateMode && selectedType?.choose_repository">
            <v-autocomplete
              v-model="formData.repository"
              v-model:search="repositorySearch"
              :items="repositories"
              :loading="loadingRepositories"
              :rules="rules.repository"
              item-title="name"
              item-value="name"
              label="Repository"
              :hint="`The ${selectedType.upstream.owner} repository to work on, or the link to one of its pull requests`"
              persistent-hint
              variant="outlined"
              :prepend-inner-icon="icons.repository"
              class="mb-3"
            >
              <template #item="{ props, item }">
                <v-list-item
                  v-bind="props"
                  :subtitle="item.raw.description"
                  class="repository-item"
                />
              </template>
            </v-autocomplete>
            <v-alert
              v-if="repositoriesError"
              type="warning"
              variant="tonal"
              density="compact"
              class="mb-3"
            >
              Couldn't load the repositories: {{ repositoriesError }}
            </v-alert>
            <v-combobox
              v-model="formData.startFrom"
              :items="pullRequestItems"
              :loading="loadingPullRequests"
              :disabled="!formData.repository"
              label="Start from (Optional)"
              :placeholder="selectedRepository?.default_branch"
              :hint="startFromHint"
              persistent-hint
              variant="outlined"
              :prepend-inner-icon="icons.branch"
              class="mb-3"
              @update:model-value="startFromChanged"
            >
              <template #item="{ props, item }">
                <v-list-item v-bind="props" :subtitle="item.raw.subtitle" class="repository-item" />
              </template>
            </v-combobox>
            <v-alert
              v-if="pullRequestsError"
              type="warning"
              variant="tonal"
              density="compact"
              class="mb-3"
            >
              Couldn't load the pull requests: {{ pullRequestsError }}
            </v-alert>
          </template>

          <v-text-field
            v-model="formData.title"
            label="Workspace Title"
            placeholder="My Workspace"
            :rules="rules.title"
            variant="outlined"
            :prepend-inner-icon="icons.folder"
            required
            autofocus
            class="mb-3"
          ></v-text-field>

          <SelectionSelect
            v-if="selection?.on_create"
            v-model="formData.selection"
            :items="selectionItems"
            :loading="loadingOptions"
            :no-data-text="loadingOptions ? `Loading ${selection.label}…` : undefined"
            :label="selection.label"
            :multiple="selection.multiple"
            :chips="selection.multiple"
            :rules="rules.selection"
            hint="The workspace preview is generated from this selection, for everyone with access."
            persistent-hint
            class="mb-3"
          />

          <v-alert
            v-if="selection?.on_create && optionsError"
            type="warning"
            variant="tonal"
            density="compact"
            class="mb-3"
          >
            Couldn't load the {{ selection.label }} to select from: {{ optionsError }}
          </v-alert>

          <v-textarea
            v-model="formData.description"
            persistent-counter
            label="Description (Optional)"
            placeholder="Describe the purpose of this workspace..."
            variant="outlined"
            :prepend-inner-icon="icons.text"
            rows="3"
            counter
            maxlength="500"
          ></v-textarea>

          <v-alert
            v-if="upstream && !ownedUpstreams.includes(upstream) && !isUpdateMode"
            type="info"
            variant="tonal"
            density="compact"
            class="mt-3"
          >
            Creating your first workspace also creates a copy (fork) of the
            {{ upstreamName }} repository on your GitHub account. All of your workspaces for it are
            stored there.
          </v-alert>
        </v-card-text>

        <v-divider></v-divider>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="reject">Cancel</v-btn>
          <v-btn color="primary" variant="elevated" :loading="accepting" type="submit">
            {{ submitButtonText }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-form>
  </v-dialog>
</template>

<script>
import DialogMixin from '@/components/DialogMixin';
import workspaceService from '@/services/workspace.service';
import { useWorkspacesStore } from '@/stores/workspaces';
import { useTypesStore } from '@/stores/types';
import {
  mdiFolderPlus,
  mdiFolderEdit,
  mdiFolder,
  mdiFileDocument,
  mdiShapeOutline,
  mdiSourceBranch,
  mdiSourceRepository,
  mdiText,
} from '@mdi/js';
import SelectionSelect from '@/components/SelectionSelect.vue';

export default {
  name: 'WorkspaceDialog',
  mixins: [DialogMixin],
  components: {
    SelectionSelect,
  },
  props: {
    mode: {
      type: String,
      default: 'create',
      validator: (value) => ['create', 'update'].includes(value),
    },
    workspace: {
      type: Object,
      default: null,
    },
    // The upstream repositories (owner/repo) the user has workspaces of; the first workspace of a
    // repository creates the user's GitHub fork, which the dialog discloses up front
    ownedUpstreams: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      icons: {
        folderPlus: mdiFolderPlus,
        folderEdit: mdiFolderEdit,
        folder: mdiFolder,
        fileDocument: mdiFileDocument,
        text: mdiText,
        type: mdiShapeOutline,
        repository: mdiSourceRepository,
        branch: mdiSourceBranch,
      },
      formData: {
        type: useTypesStore().availableTypes[0]?.id,
        title: '',
        selection: [],
        repository: null,
        // A branch name, or an item of pullRequestItems
        startFrom: null,
        description: '',
      },
      // The repositories of the selected type's owner, for types whose workspaces choose one
      repositories: [],
      loadingRepositories: false,
      repositoriesError: null,
      repositorySearch: '',
      // The open pull requests of the chosen repository, which a workspace can continue
      pullRequests: [],
      loadingPullRequests: false,
      pullRequestsError: null,
      pullRequestsRequest: 0,
      // From a pasted link, chosen once the pull requests are loaded
      pendingPullRequest: null,
      // What the workspace can select: the upstream's options for a new workspace, the workspace's
      // own when updating, including e.g. PFS created in it but not merged upstream yet
      selectionOptions: [],
      loadingOptions: false,
      optionsError: null,
      optionsRequest: 0,
      rules: {
        title: [
          (v) => !!v || 'Title is required',
          (v) => (v && v.length >= 3) || 'Title must be at least 3 characters',
        ],
        repository: [(v) => !!v || 'Select a repository'],
        selection: [
          (v) =>
            (Array.isArray(v) ? v.length > 0 : !!v) ||
            (this.selection?.multiple
              ? `Select at least one ${this.selection.label}`
              : `Select a ${this.selection?.label}`),
        ],
      },
    };
  },
  computed: {
    workspacesStore() {
      return useWorkspacesStore();
    },
    typesStore() {
      return useTypesStore();
    },
    selectedType() {
      return this.typesStore.byId(this.formData.type);
    },
    isUpdateMode() {
      return this.mode === 'update';
    },
    dialogTitle() {
      return this.isUpdateMode ? 'Update Workspace' : 'Create New Workspace';
    },
    dialogIcon() {
      return this.isUpdateMode ? this.icons.folderEdit : this.icons.folderPlus;
    },
    submitButtonText() {
      return this.isUpdateMode ? 'Update Workspace' : 'Create Workspace';
    },
    selection() {
      return this.selectedType?.selection ?? null;
    },
    selectedRepository() {
      return this.repositories.find((repository) => repository.name === this.formData.repository);
    },
    // The repository the new workspace forks, as owner/repo
    upstream() {
      const upstream = this.selectedType?.upstream;
      if (!upstream) {
        return null;
      }
      if (this.selectedType.choose_repository) {
        return this.formData.repository ? `${upstream.owner}/${this.formData.repository}` : null;
      }
      return `${upstream.owner}/${upstream.repo}`;
    },
    upstreamName() {
      return this.selectedType?.choose_repository
        ? this.formData.repository
        : this.selectedType?.title;
    },
    selectionItems() {
      return this.loadingOptions ? [] : this.selectionOptions;
    },
    pullRequestItems() {
      return this.pullRequests.map((pullRequest) => ({
        title: `#${pullRequest.number} ${pullRequest.title}`,
        value: pullRequest.number,
        subtitle: [pullRequest.author, pullRequest.head].filter(Boolean).join(' · '),
        pullRequest,
      }));
    },
    // The pull request the workspace continues, if any
    chosenPullRequest() {
      return this.formData.startFrom?.pullRequest ?? null;
    },
    startFromHint() {
      const pullRequest = this.chosenPullRequest;
      return pullRequest
        ? `Continues pull request #${pullRequest.number}: changes are proposed to its branch ${pullRequest.head}`
        : 'A branch to start from and propose changes to, or an open pull request to continue. The default branch if empty.';
    },
  },
  watch: {
    // The options of another type don't apply
    'formData.type'() {
      if (!this.isUpdateMode) {
        this.formData.selection = [];
      }
    },
    selection: {
      immediate: true,
      handler(selection) {
        if (selection?.on_create) {
          this.loadSelectionOptions(this.formData.type);
        }
      },
    },
    selectedType: {
      immediate: true,
      handler(type) {
        if (!this.isUpdateMode && type?.choose_repository) {
          this.loadRepositories(type.id);
        }
      },
    },
    'formData.repository'(repository) {
      this.formData.startFrom = null;
      this.loadPullRequests(repository);
    },
    repositorySearch(text) {
      const link = this.parsePullRequestLink(text);
      if (link) {
        this.pendingPullRequest = link.number;
        if (this.formData.repository === link.repository) {
          this.choosePendingPullRequest();
        } else {
          this.formData.repository = link.repository;
        }
      }
    },
  },
  created() {
    if (this.workspace) {
      this.formData = {
        type: this.workspace.type,
        title: this.workspace.title || '',
        selection: [...(this.workspace.selection ?? [])],
        description: this.workspace.description || '',
      };
    }
  },
  methods: {
    async loadSelectionOptions(typeId) {
      // Switching types can leave an older request running
      const request = ++this.optionsRequest;
      this.selectionOptions = [];
      this.optionsError = null;
      this.loadingOptions = true;
      try {
        const options = this.isUpdateMode
          ? await workspaceService.fetchSelectionOptions(this.workspace.id)
          : await workspaceService.fetchTypeSelectionOptions(typeId);
        if (request === this.optionsRequest) {
          this.selectionOptions = options;
        }
      } catch (error) {
        if (request === this.optionsRequest) {
          this.optionsError = error.message;
        }
      } finally {
        if (request === this.optionsRequest) {
          this.loadingOptions = false;
        }
      }
    },
    async loadRepositories(typeId) {
      this.repositories = [];
      this.formData.repository = null;
      this.repositoriesError = null;
      this.loadingRepositories = true;
      try {
        const repositories = await workspaceService.fetchRepositories(typeId);
        if (this.formData.type === typeId) {
          this.repositories = repositories;
        }
      } catch (error) {
        this.repositoriesError = error.message;
      } finally {
        this.loadingRepositories = false;
      }
    },
    async loadPullRequests(repository) {
      const request = ++this.pullRequestsRequest;
      this.pullRequests = [];
      this.pullRequestsError = null;
      if (!repository) {
        this.loadingPullRequests = false;
        return;
      }
      this.loadingPullRequests = true;
      try {
        const pullRequests = await workspaceService.fetchPullRequests(
          this.formData.type,
          repository,
        );
        if (request === this.pullRequestsRequest) {
          this.pullRequests = pullRequests;
          this.loadingPullRequests = false;
          this.choosePendingPullRequest();
        }
      } catch (error) {
        if (request === this.pullRequestsRequest) {
          this.pullRequestsError = error.message;
        }
      } finally {
        if (request === this.pullRequestsRequest) {
          this.loadingPullRequests = false;
        }
      }
    },
    // A link to a pull request of one of the owner's repositories, e.g. https://github.com/opengeospatial/geoparquet/pull/304
    parsePullRequestLink(text) {
      const match = /^\s*(?:https?:\/\/)?github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/i.exec(
        text ?? '',
      );
      if (!match || match[1].toLowerCase() !== this.selectedType?.upstream?.owner?.toLowerCase()) {
        return null;
      }
      const repository = this.repositories.find(
        (item) => item.name.toLowerCase() === match[2].toLowerCase(),
      );
      return repository ? { repository: repository.name, number: Number(match[3]) } : null;
    },
    choosePendingPullRequest() {
      if (this.pendingPullRequest === null || this.loadingPullRequests) {
        return;
      }
      const number = this.pendingPullRequest;
      this.pendingPullRequest = null;
      // Not open anymore: kept as typed, so creating the workspace tells why it can't
      const item = this.pullRequestItems.find((candidate) => candidate.value === number);
      this.formData.startFrom = item ?? `#${number}`;
      this.startFromChanged(this.formData.startFrom);
    },
    startFromChanged(value) {
      const link = typeof value === 'string' ? this.parsePullRequestLink(value) : null;
      if (link && link.repository === this.formData.repository) {
        this.pendingPullRequest = link.number;
        this.choosePendingPullRequest();
        return;
      }
      if (value?.pullRequest && !this.formData.title) {
        this.formData.title = value.pullRequest.title.slice(0, 50).trim();
      }
    },
    async handleSubmit() {
      const { valid } = await this.$refs.form.validate();
      if (!valid) return;

      const payload = {
        type: this.formData.type,
        title: this.formData.title,
        description: this.formData.description || null,
      };
      if (this.selection?.on_create) {
        payload.selection = this.selection.multiple
          ? this.formData.selection
          : [this.formData.selection].flat();
      }
      if (!this.isUpdateMode && this.selectedType?.choose_repository) {
        payload.repository = this.formData.repository;
        const startFrom = this.formData.startFrom;
        const typedNumber =
          typeof startFrom === 'string' ? /^#(\d+)$/.exec(startFrom.trim()) : null;
        if (this.chosenPullRequest) {
          payload.pull_request = this.chosenPullRequest.number;
        } else if (typedNumber) {
          payload.pull_request = Number(typedNumber[1]);
        } else if (typeof startFrom === 'string' && startFrom.trim()) {
          payload.branch = startFrom.trim();
        }
      }

      // Include workspace ID for update mode
      if (this.isUpdateMode && this.workspace) {
        payload.id = this.workspace.id;
      }

      this.accept(payload);
    },
  },
};
</script>

<style scoped>
/* Long descriptions are cut instead of widening the menu, which would change its width while scrolling */
.repository-item :deep(.v-list-item-subtitle) {
  contain: inline-size;
}
</style>
