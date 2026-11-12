/** The folder of a file path without the leading slash, e.g. `pfs/SR`; empty at the root. */
export function folderOf(path) {
  return path.slice(1, Math.max(path.lastIndexOf('/'), 1));
}

/**
 * For files with the same name, the shortest end of their folders that tells them apart, like
 * VS Code's tabs: `/pfs/SR/document.yaml` -> `SR`. Files with a unique name get none.
 * @param {string[]} paths
 * @returns {Object<string, string>} path -> folder hint
 */
export function folderHints(paths) {
  const byName = {};
  for (const path of paths) {
    (byName[path.split('/').pop()] ??= []).push(path);
  }
  const hints = {};
  for (const group of Object.values(byName)) {
    if (group.length < 2) {
      continue;
    }
    const folders = group.map((path) => folderOf(path).split('/').filter(Boolean));
    const depth = Math.max(...folders.map((segments) => segments.length));
    for (let n = 1; n <= depth; n++) {
      const ends = folders.map((segments) => segments.slice(-n).join('/') || '/');
      if (new Set(ends).size === ends.length || n === depth) {
        group.forEach((path, i) => (hints[path] = ends[i]));
        break;
      }
    }
  }
  return hints;
}
