import { mdiCommentOutline, mdiEyeOutline } from '@mdi/js';

/**
 * Access levels a workspace can be shared at. Shape matches Vuetify's
 * v-select/v-combobox `items` prop (value/title) so it can be used directly.
 *
 * Commenters read like viewers and also comment; only the owner edits files.
 */
export const ACCESS_MODES = [
  {
    value: 'readonly',
    title: 'View only',
    icon: mdiEyeOutline,
    summary: 'You can view',
    description: 'Read the files, the preview and the comments. Only the owner changes files.',
  },
  {
    value: 'comment',
    title: 'Can comment',
    icon: mdiCommentOutline,
    summary: 'You can view and comment',
    description:
      'Read the files and the preview, and discuss them in comments. Only the owner changes files.',
  },
];

export function shareModeLabel(mode) {
  return ACCESS_MODES.find((option) => option.value === mode)?.title || mode;
}

export function shareModeIcon(mode) {
  return ACCESS_MODES.find((option) => option.value === mode)?.icon;
}

export function shareMode(mode) {
  return ACCESS_MODES.find((option) => option.value === mode);
}
