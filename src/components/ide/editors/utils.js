import { useTypesStore } from '@/stores/types';
import { matchesGlob } from '@/utils/glob';

/** The form editor rule of the workspace type that applies to the file, if any. */
export function getEditorRule(file) {
  const rules = useTypesStore().currentType?.editors ?? [];
  return rules.find((rule) => matchesGlob(file.path, rule.match)) ?? null;
}

export function supportVisualEditing(file) {
  return Boolean(getEditorRule(file)?.schema);
}

export function getEditingSchema(file) {
  return getEditorRule(file)?.schema ?? {};
}

export function getUiSchema(file) {
  return getEditorRule(file)?.ui_schema;
}
