// Utility module for input sanitization

const path = require('path');

/**
 * Sanitize a file path to prevent path traversal attacks
 * @param {string} filePath - The file path to sanitize
 * @returns {string} - The sanitized file path
 */
function sanitizePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return '';
  }

  // Normalize path to prevent path traversal attacks
  // This resolves '..' and '.' segments to create a clean path
  const normalized = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
  
  // Replace any backslashes with forward slashes for consistency
  return normalized.replace(/\\/g, '/');
}

/**
 * Sanitize a string to prevent potential XSS attacks
 * @param {string} input - The string to sanitize
 * @returns {string} - The sanitized string
 */
function sanitizeString(input) {
  if (input === undefined || input === null) {
    return '';
  }
  
  if (typeof input !== 'string') {
    return String(input);
  }
  
  // Replace potentially dangerous HTML characters with their encoded versions
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitize an object by sanitizing all string properties
 * @param {Object} obj - The object to sanitize
 * @returns {Object} - A new object with sanitized properties
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return {};
  }
  
  const sanitized = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Sanitize query parameters
 * @param {Object} query - The query object to sanitize
 * @returns {Object} - A new object with sanitized query parameters
 */
function sanitizeQuery(query) {
  return sanitizeObject(query);
}

/**
 * Validate and sanitize a workspace ID
 * @param {string} id - The workspace ID to validate 
 * @returns {string} - The sanitized workspace ID
 */
function sanitizeWorkspaceId(id) {
  if (!id || typeof id !== 'string') {
    return '';
  }
  
  // Only allow alphanumeric characters and hyphens (UUID format)
  return id.replace(/[^a-zA-Z0-9\-]/g, '');
}

module.exports = {
  sanitizePath,
  sanitizeString,
  sanitizeObject,
  sanitizeQuery,
  sanitizeWorkspaceId
};