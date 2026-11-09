import { mdiCommentOutline, mdiEyeOutline } from '@mdi/js';

/**
 * Access levels a workspace can be shared at. Shape matches Vuetify's
 * v-select/v-combobox `items` prop (value/title) so it can be used directly.
 *
 * Commenters read like viewers and also comment; only the owner edits files.
 */
export const ACCESS_MODES = [
  { value: 'readonly', title: 'View only', icon: mdiEyeOutline },
  { value: 'comment', title: 'Can comment', icon: mdiCommentOutline },
];

export function shareModeLabel(mode) {
  return ACCESS_MODES.find((option) => option.value === mode)?.title || mode;
}

export function shareModeIcon(mode) {
  return ACCESS_MODES.find((option) => option.value === mode)?.icon;
}
