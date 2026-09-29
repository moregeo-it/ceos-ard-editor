// What the editor knows about the session. The JWT itself is an HttpOnly cookie on the API host,
// out of reach of page scripts; this only holds who is logged in and until when.
const SESSION_KEY = 'ceos_ard_editor_session';

// Written by editors before the session cookie; removed so no JWT stays behind in localStorage
const LEGACY_KEYS = [
  'ceos_ard_editor_access_token',
  'ceos_ard_editor_token_type',
  'ceos_ard_editor_user_id',
  'ceos_ard_editor_username',
  'ceos_ard_editor_provider',
  'ceos_ard_editor_expires_at',
];

/**
 * @typedef {Object} Session
 * @property {string} userId
 * @property {string} username
 * @property {string} provider
 * @property {number} expiresAt Unix time in milliseconds
 */

/** @returns {Session|null} */
function parse(value) {
  try {
    const session = JSON.parse(value);
    return session?.userId && Number.isFinite(session.expiresAt) ? session : null;
  } catch {
    return null;
  }
}

export default {
  KEY: SESSION_KEY,
  parse,

  /** @param {Session} session */
  save(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  },

  /** @returns {Session|null} */
  load() {
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
    return parse(localStorage.getItem(SESSION_KEY));
  },

  clear() {
    localStorage.removeItem(SESSION_KEY);
  },
};
