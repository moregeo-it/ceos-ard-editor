/**
 * A glob such as `glossary/*.yaml` as a regular expression for workspace paths without leading
 * slash: `*` matches within a folder, `**` across folders.
 */
export function globToRegExp(glob) {
  let pattern = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === '*' && glob[i + 1] === '*' && glob[i + 2] === '/') {
      // A non-empty prefix must end with a slash: `**/foo` doesn't match `notfoo`
      pattern += '(?:.*/)?';
      i += 2;
    } else if (char === '*' && glob[i + 1] === '*') {
      pattern += '.*';
      i++;
    } else if (char === '*') {
      pattern += '[^/]*';
    } else if (char === '?') {
      pattern += '[^/]';
    } else {
      pattern += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${pattern}$`);
}

export function matchesGlob(path, glob) {
  return globToRegExp(glob).test(path.replace(/^\/+/, ''));
}
