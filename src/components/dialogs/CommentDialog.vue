<template>
  <v-dialog v-model="show" :max-width="sizes.medium">
    <v-form @submit.prevent="submit">
      <v-card>
        <v-card-title>Comment on {{ fileName }}</v-card-title>
        <v-card-subtitle><FilePath :path="path" /></v-card-subtitle>
        <v-card-text>
          <v-textarea
            v-model="body"
            label="Comment"
            :readonly="accepting"
            hint="Markdown is supported. Press Ctrl+Enter to send."
            persistent-hint
            auto-grow
            rows="3"
            :counter="maxLength"
            variant="outlined"
            autofocus
            @keydown.enter.ctrl.prevent="submit"
            @keydown.enter.meta.prevent="submit"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="reject">Cancel</v-btn>
          <v-btn
            color="primary"
            type="submit"
            variant="elevated"
            :loading="accepting"
            :disabled="!isValid"
          >
            Comment
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-form>
  </v-dialog>
</template>

<script>
import DialogMixin from '@/components/DialogMixin';
import FilePath from '@/components/FilePath.vue';

export default {
  name: 'CommentDialog',
  mixins: [DialogMixin],
  components: {
    FilePath,
  },
  props: {
    path: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      body: '',
      maxLength: 10000,
    };
  },
  computed: {
    fileName() {
      return this.path.split('/').pop();
    },
    isValid() {
      const length = this.body.trim().length;
      return length > 0 && length <= this.maxLength;
    },
  },
  methods: {
    submit() {
      if (this.isValid && !this.accepting) {
        this.accept(this.body.trim());
      }
    },
  },
};
</script>
