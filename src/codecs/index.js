import { dump, load } from '@/utils/enhanced-yaml';

// Turn a file into the data the form editor shows and back; `stringify` gets the current text
// so it can keep the formatting of everything that didn't change. A workspace type names the codec
// of a form editor (`editors` in GET /types); files with a codec missing here open in the source editor.
export const codecs = {
  yaml: {
    parse: (text) => load(text),
    stringify: (value, original) => dump(value, {}, original),
  },
};
