import { SafeHttpService } from './safe-http.service.js';
import { detectFileFormat } from './file-detection.service.js';
import { resolveFilenames } from '../utils/filename.js';
import { formatBytes } from '../utils/format-size.js';
import { normalizeMimeType, isHtmlMimeType } from '../utils/mime.js';
import { LIMITS } from '../config/limits.js';
import { UnprocessableEntityError } from '../utils/errors.js';

export class MetadataService {
  /**
   * Inspects a remote URL and returns complete structured metadata.
   * @param {string} url
   * @param {object} [options]
   * @param {boolean} [options.allowLocalTest]
   * @param {boolean} [options.allowHtml] Whether to allow HTML content (for link extraction)
   * @returns {Promise<object>} Complete file metadata
   */
  static async inspectUrl(url, options = {}) {
    const allowLocalTest = options.allowLocalTest || false;
    const allowHtml = options.allowHtml || false;

    // 1. First probe using bounded GET / Range request (or HEAD fallback)
    // Using getProbeBuffer fetches up to 16KB which gives us headers, status, range support AND magic bytes in 1 safe round-trip!
    let probeRes;
    try {
      probeRes = await SafeHttpService.getProbeBuffer(url, {
        allowLocalTest,
        timeoutMs: LIMITS.REQUEST_TIMEOUT_MS,
        maxRedirects: LIMITS.MAX_REDIRECTS
      });
    } catch (err) {
      // If probe failed with 405 Method Not Allowed or 501, try HEAD
      probeRes = await SafeHttpService.head(url, {
        allowLocalTest,
        timeoutMs: LIMITS.REQUEST_TIMEOUT_MS,
        maxRedirects: LIMITS.MAX_REDIRECTS
      });
    }

    const { status, headers, body, finalUrl, redirectCount } = probeRes;
    const supportsRanges = probeRes.supportsRanges || headers['accept-ranges'] === 'bytes' || status === 206;
    const requiresAuth = status === 401 || status === 403;

    // 2. Extract file size
    let sizeBytes = null;
    if (headers['content-length']) {
      const parsedLength = parseInt(headers['content-length'], 10);
      if (!isNaN(parsedLength) && parsedLength >= 0) {
        sizeBytes = parsedLength;
      }
    } else if (headers['content-range']) {
      // Content-Range: bytes 0-16383/26004684
      const match = headers['content-range'].match(/\/(\d+|\*)$/);
      if (match && match[1] !== '*') {
        const total = parseInt(match[1], 10);
        if (!isNaN(total) && total >= 0) {
          sizeBytes = total;
        }
      }
    }

    const sizeHuman = formatBytes(sizeBytes);
    const serverMimeType = normalizeMimeType(headers['content-type']);
    const dispositionHeader = headers['content-disposition'];

    // If upstream returns an HTML document and caller expects a direct downloadable file:
    if (!allowHtml && isHtmlMimeType(serverMimeType)) {
      // Check if it really is an HTML page (not an SVG or download page)
      const previewText = body ? body.subarray(0, 1024).toString('utf-8').toLowerCase() : '';
      if (previewText.includes('<!doctype html') || previewText.includes('<html')) {
        throw new UnprocessableEntityError('The target URL returned an HTML webpage rather than a direct downloadable file. Use the link extraction endpoint to find downloadable files on this page.');
      }
    }

    // 3. Resolve filenames and initial extension
    const preliminary = resolveFilenames({
      dispositionHeader,
      url: finalUrl
    });

    // 4. Run binary signature & format detection
    const detection = await detectFileFormat({
      buffer: body || Buffer.alloc(0),
      serverMimeType,
      filename: preliminary.originalFilename || preliminary.safeFilename
    });

    // 5. Finalize safe filename with verified/inferred extension
    const resolved = resolveFilenames({
      dispositionHeader,
      url: finalUrl,
      detectedExt: detection.extension
    });

    // 6. Security warnings compilation
    const securityWarnings = [...detection.securityWarnings];

    // Check size limit warning
    if (sizeBytes !== null && sizeBytes > LIMITS.MAX_FILE_SIZE_BYTES) {
      securityWarnings.push(`File size (${sizeHuman}) exceeds configured maximum limit of ${formatBytes(LIMITS.MAX_FILE_SIZE_BYTES)}.`);
    }

    // Check cross-domain redirect warning
    try {
      const origHost = new URL(url).hostname;
      const finalHost = new URL(finalUrl).hostname;
      if (origHost.toLowerCase() !== finalHost.toLowerCase()) {
        securityWarnings.push(`Redirected cross-domain: Origin "${origHost}" redirected to "${finalHost}".`);
      }
    } catch {
      // Ignore URL parsing errors here
    }

    const downloadAvailable = (status === 200 || status === 206) && !requiresAuth;

    return {
      filename: resolved.originalFilename,
      safeFilename: resolved.safeFilename,
      extension: resolved.extension || detection.extension,
      mimeType: serverMimeType,
      detectedMimeType: detection.detectedMimeType,
      sizeBytes,
      sizeHuman,
      fileType: detection.category,
      formatStatus: detection.formatStatus,
      description: detection.description,
      supportsRanges,
      downloadAvailable,
      requiresAuth,
      httpStatus: status,
      finalUrl,
      redirectCount,
      securityWarnings,
      detectedAt: new Date().toISOString()
    };
  }
}

export default MetadataService;
