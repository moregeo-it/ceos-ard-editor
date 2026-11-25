import { dump, load } from '@/utils/enhanced-yaml';
import * as modspec from './modspec';

// Turn a file into the data the form editor shows and back; `stringify` gets the current text
// so it can keep the formatting of everything that didn't change. A workspace type names the codec
// of a form editor (`editors` in GET /types); files with a codec missing here open in the source editor.
// `accepts`, if given, tells whether a file is one the form can edit; others open in their usual editor.
export const codecs = {
  yaml: {
    parse: (text) => load(text),
    stringify: (value, original) => dump(value, {}, original),
  },
  modspec: {
    accepts: modspec.accepts,
    parse: modspec.parse,
    stringify: modspec.stringify,
  },
};
