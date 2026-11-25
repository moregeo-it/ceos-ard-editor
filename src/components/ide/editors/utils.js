import { codecs } from '@/codecs';
import { useTypesStore } from '@/stores/types';
import { matchesGlob } from '@/utils/glob';

/**
 * The form editor rule of the workspace type that applies to the file, if any. Given the file's text
 * (undefined while it loads), only a rule whose codec accepts it.
 */
export function getEditorRule(file, ...text) {
  const rules = useTypesStore().currentType?.editors ?? [];
  return (
    rules.find((rule) => {
      const codec = codecs[rule.codec];
      if (!codec || !matchesGlob(file.path, rule.match)) {
        return false;
      }
      return (
        !codec.accepts ||
        text.length === 0 ||
        (typeof text[0] === 'string' && codec.accepts(text[0]))
      );
    }) ?? null
  );
}

export function isAsciiDoc(file) {
  return /\.(adoc|asciidoc)$/i.test(file.path);
}

/** Whether the file opens in a form, from the workspace type's `editors`. */
export function hasForm(file, text) {
  return Boolean(getEditorRule(file, text)?.schema);
}

export function supportVisualEditing(file, text) {
  return hasForm(file, text) || isAsciiDoc(file);
}

export function getEditingSchema(file) {
  return getEditorRule(file)?.schema ?? {};
}

export function getUiSchema(file) {
  return getEditorRule(file)?.ui_schema;
}

export function getCodec(file) {
  return codecs[getEditorRule(file)?.codec] ?? codecs.yaml;
}
