import path from 'path';
import contentDisposition from 'content-disposition';

// Windows reserved device names
const WINDOWS_RESERVED_NAMES = new Set([
  'con', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'
]);

/**
 * Extracts a filename from Content-Disposition header.
 * @param {string} header
 * @returns {string|null}
 */
export function extractFilenameFromDisposition(header) {
  if (!header || typeof header !== 'string') return null;

  try {
    const parsed = contentDisposition.parse(header);
    if (parsed && parsed.parameters && parsed.parameters.filename) {
      return parsed.parameters.filename;
    }
  } catch {
    // Fall back to robust regex if content-disposition fails on malformed input
    const match = header.match(/filename\*?=(?:UTF-8''|"?)([^";\r\n]+)"?/i);
    if (match && match[1]) {
      try {
        return decodeURIComponent(match[1].trim());
      } catch {
        return match[1].trim();
      }
    }
  }
  return null;
}

/**
 * Extracts a filename from a URL path.
 * @param {string} urlStr
 * @returns {string|null}
 */
export function extractFilenameFromUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return null;

  try {
    const parsed = new URL(urlStr);
    const pathname = parsed.pathname;
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return null;

    const rawLast = segments[segments.length - 1];
    let decoded;
    try {
      decoded = decodeURIComponent(rawLast);
    } catch {
      decoded = rawLast;
    }

    const trimmed = decoded.trim();
    // If it's just dots, empty, or index/default, ignore
    if (!trimmed || trimmed === '.' || trimmed === '..') return null;
    return trimmed;
  } catch {
    return null;
  }
}

/**
 * Sanitizes a filename, preventing path traversal, null bytes, Windows reserved names,
 * and dangerous filesystem characters.
 * @param {string} name
 * @param {string} [fallback='download.bin']
 * @returns {string} Safe filename
 */
export function sanitizeFilename(name, fallback = 'download.bin') {
  if (!name || typeof name !== 'string') return fallback;

  // 1. Remove null bytes and control characters (0-31, 127)
  let cleaned = name.replace(/[\x00-\x1F\x7F]/g, '');

  // 2. Remove directory traversal sequences and slashes
  cleaned = cleaned.replace(/\\/g, '/');
  cleaned = path.basename(cleaned); // Extracts filename without path
  cleaned = cleaned.replace(/^\.+/, ''); // Strip leading dots (hidden files or traversal)

  // 3. Remove illegal Windows & Unix filesystem characters: < > : " / \ | ? *
  cleaned = cleaned.replace(/[<>:"/\\|?*]/g, '_');

  // 4. Collapse consecutive spaces and underscores
  cleaned = cleaned.replace(/[\s_]+/g, '_').trim();

  // 5. Check if filename base matches Windows reserved device name
  const ext = path.extname(cleaned);
  const baseName = path.basename(cleaned, ext).toLowerCase();

  if (WINDOWS_RESERVED_NAMES.has(baseName)) {
    cleaned = `safe_${cleaned}`;
  }

  // 6. Max length 255 chars preserving extension
  if (cleaned.length > 255) {
    const extLen = ext.length;
    const baseLen = 255 - extLen;
    cleaned = cleaned.substring(0, baseLen) + ext;
  }

  // If nothing remains or invalid, return fallback
  if (!cleaned || cleaned === '.' || cleaned === '_') {
    return fallback;
  }

  return cleaned;
}

/**
 * Extracts extension from filename (without leading dot).
 * @param {string} filename
 * @returns {string|null}
 */
export function extractExtension(filename) {
  if (!filename || typeof filename !== 'string') return null;
  const ext = path.extname(filename);
  if (!ext || ext === '.') return null;
  return ext.replace(/^\./, '').toLowerCase();
}

/**
 * Determines original, safe, and extension attributes for a target URL and headers.
 * @param {object} params
 * @param {string} [params.dispositionHeader]
 * @param {string} params.url
 * @param {string} [params.detectedExt]
 * @returns {{ originalFilename: string|null, safeFilename: string, extension: string|null }}
 */
export function resolveFilenames({ dispositionHeader, url, detectedExt }) {
  const fromDisposition = extractFilenameFromDisposition(dispositionHeader);
  const fromUrl = extractFilenameFromUrl(url);

  const originalFilename = fromDisposition || fromUrl || null;
  let fallbackName = 'download';
  if (detectedExt) {
    fallbackName = `download.${detectedExt}`;
  } else {
    fallbackName = 'download.bin';
  }

  let safeFilename = originalFilename ? sanitizeFilename(originalFilename, fallbackName) : fallbackName;
  let extension = extractExtension(safeFilename);

  // If safeFilename has no extension but we detected one via binary inspection, append it
  if (!extension && detectedExt) {
    safeFilename = `${safeFilename}.${detectedExt}`;
    extension = detectedExt;
  }

  return {
    originalFilename,
    safeFilename,
    extension
  };
}
