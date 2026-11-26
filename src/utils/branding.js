// Set per deployment, e.g. for an editor that covers more than CEOS-ARD
const env = import.meta.env;

export const APP_TITLE = env.VITE_APP_TITLE || 'CEOS-ARD Editor';
export const APP_SUBTITLE =
  env.VITE_APP_SUBTITLE ||
  'Collaborative Product Specification Editor for CEOS Analysis Ready Data';
export const APP_NOTICE =
  env.VITE_APP_NOTICE ||
  `This is a prototype version of the ${APP_TITLE}. Functionality may be limited and data may be reset periodically.`;
// A URL, "none" for no logo, or empty for the CEOS-ARD logo
export const APP_LOGO = env.VITE_APP_LOGO || '';
// "Title|URL" pairs separated by ";", shown before moreGeo and the imprint
export const APP_LINKS = (
  env.VITE_APP_LINKS ||
  'CEOS-ARD Website|https://ceos.org/ard/;CEOS GitHub Organization|https://github.com/ceos-org'
)
  .split(';')
  .map((link) => link.split('|').map((part) => part.trim()))
  .filter(([title, url]) => title && url)
  .map(([title, url]) => ({ title, url }));
