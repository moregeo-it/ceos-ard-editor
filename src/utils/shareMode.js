import { mdiPencil, mdiCommentOutline, mdiEyeOutline } from '@mdi/js';

/**
 * Access levels a workspace can be shared at. Shape matches Vuetify's
 * v-select/v-combobox `items` prop (value/title) so it can be used directly.
 */
export const SHARE_MODES = [
  { value: 'edit', title: 'Can edit', icon: mdiPencil },
  { value: 'comment', title: 'Can comment', icon: mdiCommentOutline },
  { value: 'readonly', title: 'View only', icon: mdiEyeOutline },
];

export function shareModeLabel(mode) {
  return SHARE_MODES.find((option) => option.value === mode)?.title || mode;
}

export function shareModeIcon(mode) {
  return SHARE_MODES.find((option) => option.value === mode)?.icon;
}
