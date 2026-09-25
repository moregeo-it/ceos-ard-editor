import { mdiEyeOutline } from '@mdi/js';

/**
 * Access levels a workspace can be shared at. Shape matches Vuetify's
 * v-select/v-combobox `items` prop (value/title) so it can be used directly.
 *
 * Phase 1 supports readonly sharing only. Additional roles (comment, edit) are
 * deferred to later phases.
 */
export const SHARE_MODES = [{ value: 'readonly', title: 'View only', icon: mdiEyeOutline }];

export function shareModeLabel(mode) {
  return SHARE_MODES.find((option) => option.value === mode)?.title || mode;
}

export function shareModeIcon(mode) {
  return SHARE_MODES.find((option) => option.value === mode)?.icon;
}
