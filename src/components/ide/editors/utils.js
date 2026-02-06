const GLOSSARY_SCHEMA = {
  type: 'object',
  properties: {
    term: {
      type: 'string',
      minLength: 2,
    },
    description: {
      type: 'string',
      minLength: 2,
    },
  },
};

const GLOSSARY_UI_SCHEMA = {
  type: 'VerticalLayout',
  elements: [
    { type: 'Control', scope: '#/properties/term' },
    {
      type: 'Control',
      scope: '#/properties/description',
      options: { multi: true },
    },
  ],
};

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
