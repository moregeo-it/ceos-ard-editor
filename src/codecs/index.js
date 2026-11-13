import { dump, load } from '@/utils/enhanced-yaml';
import * as glossaryTerm from './glossary-term';

// Turn a file into the data the form editor shows and back; `stringify` gets the current text
// so it can keep the formatting of everything that didn't change
export const codecs = {
  yaml: {
    parse: (text) => load(text),
    stringify: (value, original) => dump(value, {}, original),
  },
  'glossary-term': {
    parse: glossaryTerm.parse,
    stringify: glossaryTerm.stringify,
  },
};
