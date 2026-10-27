import { fileTypeFromBuffer } from 'file-type';
import {
  SUPPORTED_FORMATS,
  FILE_CATEGORIES,
  getFormatInfoByExtension,
  getFormatInfoByMime
} from '../config/registry.js';
import { normalizeMimeType, getExtensionFromMime } from '../utils/mime.js';
import { extractExtension } from '../utils/filename.js';

/**
 * Checks if a buffer is valid UTF-8 text with mostly printable characters and no null bytes.
 * @param {Buffer} buffer
 * @returns {boolean}
 */
function isPlainTextBuffer(buffer) {
  if (!buffer || buffer.length === 0) return false;
  // Check first 1024 bytes for null bytes or control characters
  const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
  for (let i = 0; i < sample.length; i++) {
    const byte = sample[i];
    if (byte === 0x00) return false; // Null byte indicates binary
    // Allow tab (9), newline (10), carriage return (13), and printable chars (32-126) or UTF-8 multibyte (>127)
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
      return false;
    }
  }
  return true;
}

/**
 * Checks if a buffer represents an SVG image.
 * @param {Buffer} buffer
 * @returns {boolean}
 */
function isSvgBuffer(buffer) {
  if (!buffer || buffer.length < 10) return false;
  if (!isPlainTextBuffer(buffer)) return false;
  const str = buffer.subarray(0, Math.min(buffer.length, 2048)).toString('utf-8').toLowerCase();
  return str.includes('<svg') && (str.includes('xmlns') || str.includes('viewbox') || str.includes('</svg>'));
}

/**
 * Checks if a buffer represents a TAR archive.
 * TAR archives have the magic string "ustar" at offset 257.
 * @param {Buffer} buffer
 * @returns {boolean}
 */
function isTarBuffer(buffer) {
  if (!buffer || buffer.length < 262) return false;
  const magic = buffer.subarray(257, 262).toString('ascii');
  return magic === 'ustar';
}

/**
 * Checks if a buffer is a CSV file.
 * @param {Buffer} buffer
 * @param {string|null} urlExtension
 * @returns {boolean}
 */
function isCsvBuffer(buffer, urlExtension) {
  if (!isPlainTextBuffer(buffer)) return false;
  if (urlExtension === 'csv') return true;
  const sample = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('utf-8');
  const lines = sample.split(/\r?\n/).filter(Boolean);
  if (lines.length >= 2) {
    const commaCount1 = (lines[0].match(/,/g) || []).length;
    const commaCount2 = (lines[1].match(/,/g) || []).length;
    if (commaCount1 > 0 && commaCount1 === commaCount2) {
      return true;
    }
  }
  return false;
}

/**
 * Detects file format from probe buffer, HTTP Content-Type, and URL extension.
 *
 * @param {object} params
 * @param {Buffer} [params.buffer] Initial probe bytes
 * @param {string|null} [params.serverMimeType] Content-Type header from upstream
 * @param {string|null} [params.filename] Extracted filename
 * @returns {Promise<{
 *   extension: string|null,
 *   detectedMimeType: string|null,
 *   category: string,
 *   formatStatus: 'verified'|'inferred'|'unknown',
 *   description: string,
 *   securityWarnings: string[]
 * }>}
 */
export async function detectFileFormat({ buffer, serverMimeType, filename }) {
  const securityWarnings = [];
  const normalizedServerMime = normalizeMimeType(serverMimeType);
  const rawExt = extractExtension(filename);

  let detectedExt = null;
  let detectedMime = null;
  let formatStatus = 'unknown';
  let category = 'unknown';
  let description = 'Unknown Binary Data';

  // 1. Binary signature detection via file-type
  let binaryResult = null;
  if (buffer && buffer.length > 0) {
    try {
      binaryResult = await fileTypeFromBuffer(buffer);
    } catch {
      // Ignore binary parsing errors
    }
  }

  if (binaryResult) {
    detectedExt = binaryResult.ext;
    detectedMime = binaryResult.mime;
    formatStatus = 'verified';

    const info = SUPPORTED_FORMATS[detectedExt];
    if (info) {
      category = info.category;
      description = info.description;
    } else {
      category = FILE_CATEGORIES.ARCHIVE;
      description = `${detectedExt.toUpperCase()} File`;
    }

    // Special case: DOCX, XLSX, PPTX, APK, EPUB are all ZIP-based containers.
    // If file-type detects zip, but filename or server MIME indicates Office or Android:
    if (detectedExt === 'zip') {
      if (rawExt && ['docx', 'xlsx', 'pptx', 'epub', 'apk'].includes(rawExt)) {
        const specialized = SUPPORTED_FORMATS[rawExt];
        if (specialized) {
          detectedExt = rawExt;
          detectedMime = specialized.mimes[0];
          category = specialized.category;
          description = specialized.description;
          formatStatus = 'inferred';
        }
      } else if (normalizedServerMime) {
        const mimeInfo = getFormatInfoByMime(normalizedServerMime);
        if (mimeInfo && ['docx', 'xlsx', 'pptx', 'epub', 'apk'].includes(mimeInfo.ext)) {
          detectedExt = mimeInfo.ext;
          detectedMime = normalizedServerMime;
          category = mimeInfo.category;
          description = mimeInfo.description;
          formatStatus = 'inferred';
        }
      }
    }
  } else if (buffer && buffer.length > 0) {
    // 2. Custom signature checks for non-binary and text formats
    if (isSvgBuffer(buffer)) {
      detectedExt = 'svg';
      detectedMime = 'image/svg+xml';
      category = FILE_CATEGORIES.IMAGE;
      description = 'Scalable Vector Graphics';
      formatStatus = 'verified';
    } else if (isTarBuffer(buffer)) {
      detectedExt = 'tar';
      detectedMime = 'application/x-tar';
      category = FILE_CATEGORIES.ARCHIVE;
      description = 'TAR Archive';
      formatStatus = 'verified';
    } else if (isCsvBuffer(buffer, rawExt)) {
      detectedExt = 'csv';
      detectedMime = 'text/csv';
      category = FILE_CATEGORIES.DOCUMENT;
      description = 'Comma-Separated Values';
      formatStatus = 'inferred';
    } else if (isPlainTextBuffer(buffer)) {
      detectedExt = rawExt || 'txt';
      detectedMime = 'text/plain';
      category = FILE_CATEGORIES.DOCUMENT;
      description = 'Plain Text File';
      formatStatus = 'inferred';
    }
  }

  // 3. If binary detection was inconclusive, fall back to server MIME and filename extension
  if (!detectedExt) {
    if (normalizedServerMime) {
      const mimeInfo = getFormatInfoByMime(normalizedServerMime);
      if (mimeInfo) {
        detectedExt = mimeInfo.ext;
        detectedMime = normalizedServerMime;
        category = mimeInfo.category;
        description = mimeInfo.description;
        formatStatus = 'inferred';
      } else {
        const inferredExt = getExtensionFromMime(normalizedServerMime);
        if (inferredExt) {
          detectedExt = inferredExt;
          detectedMime = normalizedServerMime;
          formatStatus = 'inferred';
          const extInfo = getFormatInfoByExtension(inferredExt);
          category = extInfo ? extInfo.category : 'unknown';
          description = extInfo ? extInfo.description : `${inferredExt.toUpperCase()} File`;
        }
      }
    }

    if (!detectedExt && rawExt) {
      const extInfo = getFormatInfoByExtension(rawExt);
      if (extInfo) {
        detectedExt = rawExt;
        detectedMime = extInfo.mimes[0];
        category = extInfo.category;
        description = extInfo.description;
        formatStatus = 'inferred';
      }
    }
  }

  // 4. Security checks and anomaly detection
  // A. Check for executable or installer packages
  if (category === FILE_CATEGORIES.PACKAGE || ['exe', 'msi', 'apk', 'deb', 'rpm', 'dmg', 'iso', 'bat', 'cmd', 'sh'].includes(detectedExt)) {
    securityWarnings.push('Executable or software package format detected. Verify file authenticity before executing.');
  }

  // B. Check for server MIME vs detected MIME mismatch
  if (formatStatus === 'verified' && normalizedServerMime && detectedMime) {
    if (normalizedServerMime !== detectedMime && !normalizedServerMime.includes('octet-stream')) {
      securityWarnings.push(`MIME mismatch: Server reported "${normalizedServerMime}" but binary signature detected "${detectedMime}".`);
    }
  }

  // C. Check for extension mismatch
  if (rawExt && detectedExt && rawExt !== detectedExt) {
    // Ignore minor variants like jpeg/jpg
    const isJpegVariant = (rawExt === 'jpg' && detectedExt === 'jpeg') || (rawExt === 'jpeg' && detectedExt === 'jpg');
    if (!isJpegVariant) {
      securityWarnings.push(`Extension mismatch: Filename extension ".${rawExt}" does not match detected format ".${detectedExt}".`);
    }
  }

  return {
    extension: detectedExt,
    detectedMimeType: detectedMime || normalizedServerMime,
    category,
    formatStatus,
    description,
    securityWarnings
  };
}

export default {
  detectFileFormat
};
