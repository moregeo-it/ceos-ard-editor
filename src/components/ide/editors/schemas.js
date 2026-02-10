const baseOptions = {
  clearable: false,
};

const baseInputOptions = {
  ...baseOptions,
};

const baseTextareaOptions = {
  ...baseOptions,
  multi: true,
};

export const GLOSSARY_SCHEMA = {
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

export const GLOSSARY_UI_SCHEMA = {
  type: 'VerticalLayout',
  elements: [
    {
      type: 'Control',
      scope: '#/properties/term',
      options: baseInputOptions,
    },
    {
      type: 'Control',
      scope: '#/properties/description',
      options: baseTextareaOptions,
    },
  ],
};
