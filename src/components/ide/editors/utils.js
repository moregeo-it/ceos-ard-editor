import { GLOSSARY_SCHEMA, GLOSSARY_UI_SCHEMA } from './schemas';

export function isGlossary(file /*, data*/) {
  return file.path.startsWith('/glossary/') && file.path.endsWith('.yaml');
}

export function supportVisualEditing(file, data) {
  if (isGlossary(file, data)) {
    return true;
  } else {
    return false;
  }
}

export function getEditingSchema(file, data) {
  if (isGlossary(file, data)) {
    return GLOSSARY_SCHEMA;
  }
  return {};
}

export function getUiSchema(file, data) {
  if (isGlossary(file, data)) {
    return GLOSSARY_UI_SCHEMA;
  }
  return undefined;
}
