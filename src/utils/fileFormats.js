// Formats a file may be created, uploaded or renamed to (the server's FILE_EXTENSIONS)
export const FILE_FORMATS = ['yaml', 'md', 'pdf', 'jpg', 'jpeg', 'png', 'bib'];

export const FORMAT_ERROR = `Only these formats are allowed: ${FILE_FORMATS.join(', ')}`;

export function fileFormat(name) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function isAllowedFormat(name) {
  return FILE_FORMATS.includes(fileFormat(name));
}
