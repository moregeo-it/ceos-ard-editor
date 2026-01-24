<template>
  <div class="pull-request pa-4 fill-height overflow-auto">
    <h2 class="mb-4">Propose Changes</h2>
    <p class="mb-4">
      This will create a "Pull Request" on GitHub where members of CEOS will review your proposed
      changes.
    </p>
    <form @submit.prevent="submitPullRequest">
      <v-text-field
        v-model="title"
        required
        label="Title"
        placeholder="Short title for the pull request"
        variant="outlined"
      ></v-text-field>

      <v-textarea
        v-model="description"
        required
        label="Description"
        placeholder="Describe the changes you are proposing..."
        hint="You can use Markdown to format your description."
        variant="outlined"
        rows="10"
      ></v-textarea>

      <v-btn type="submit" color="primary" class="mt-2 w-100">Submit</v-btn>
    </form>
  </div>
</template>

<script>
export default {
  name: 'PullRequest',
  data() {
    return {
      title: '',
      description: '',
    };
  },
  methods: {
    submitPullRequest() {
      alert('Not implemented yet!');
    },
  },
};
</script>
