import mime from 'mime-types';
import { MIME_TO_EXT_MAP } from '../config/registry.js';

/**
 * Parses and normalizes a Content-Type header.
 * @param {string|null} header
 * @returns {string|null}
 */
export function normalizeMimeType(header) {
  if (!header || typeof header !== 'string') return null;
  const parts = header.split(';');
  const rawMime = parts[0].trim().toLowerCase();
  return rawMime || null;
}

/**
 * Returns extension for a given MIME type using our registry or mime-types.
 * @param {string} mimeType
 * @returns {string|null}
 */
export function getExtensionFromMime(mimeType) {
  if (!mimeType) return null;
  const normalized = normalizeMimeType(mimeType);
  if (!normalized) return null;

  // First check our registry
  if (MIME_TO_EXT_MAP.has(normalized)) {
    return MIME_TO_EXT_MAP.get(normalized);
  }

  // Fall back to mime-types
  const ext = mime.extension(normalized);
  return ext || null;
}

/**
 * Returns MIME type for an extension.
 * @param {string} ext
 * @returns {string|null}
 */
export function getMimeFromExtension(ext) {
  if (!ext) return null;
  const cleanExt = ext.replace(/^\./, '').toLowerCase();
  const found = mime.lookup(cleanExt);
  return found || null;
}

/**
 * Checks whether a MIME type represents HTML.
 * @param {string} mimeType
 * @returns {boolean}
 */
export function isHtmlMimeType(mimeType) {
  if (!mimeType) return false;
  const normalized = normalizeMimeType(mimeType);
  return normalized === 'text/html' || normalized === 'application/xhtml+xml';
}
