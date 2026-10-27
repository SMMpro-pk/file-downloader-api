import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { SafeHttpService } from './safe-http.service.js';
import { MetadataService } from './metadata.service.js';
import { LIMITS } from '../config/limits.js';
import {
  PayloadTooLargeError,
  TooManyRequestsError,
  UpstreamError,
  ValidationError
} from '../utils/errors.js';
import { formatBytes } from '../utils/format-size.js';
import { logger } from '../utils/logger.js';

class ConcurrencySemaphore {
  constructor(max) {
    this.max = max;
    this.current = 0;
  }

  acquire() {
    if (this.current >= this.max) {
      return false;
    }
    this.current++;
    return true;
  }

  release() {
    if (this.current > 0) {
      this.current--;
    }
  }

  getActiveCount() {
    return this.current;
  }
}

export const downloadSemaphore = new ConcurrencySemaphore(LIMITS.MAX_CONCURRENT_DOWNLOADS);

/**
 * Transform stream that counts bytes and enforces maximum file size limit in real-time.
 */
class SizeEnforcementStream extends Transform {
  constructor(maxBytes, onLimitExceeded) {
    super();
    this.maxBytes = maxBytes;
    this.transferred = 0;
    this.onLimitExceeded = onLimitExceeded;
  }

  _transform(chunk, encoding, callback) {
    this.transferred += chunk.length;
    if (this.maxBytes > 0 && this.transferred > this.maxBytes) {
      if (this.onLimitExceeded) {
        this.onLimitExceeded(this.transferred);
      }
      return callback(new PayloadTooLargeError(`Downloaded stream exceeded maximum permitted size of ${this.maxBytes} bytes.`));
    }
    this.push(chunk);
    callback();
  }
}

export class DownloadService {
  /**
   * Handles secure file download via stream proxy or redirect mode.
   *
   * @param {object} params
   * @param {import('express').Request} params.req
   * @param {import('express').Response} params.res
   * @param {string} params.url
   * @param {'stream'|'redirect'} [params.mode='stream']
   * @param {boolean} [params.allowLocalTest=false]
   */
  static async handleDownload({ req, res, url, mode = 'stream', allowLocalTest = false }) {
    if (mode !== 'stream' && mode !== 'redirect') {
      throw new ValidationError('Invalid download mode. Supported modes are "stream" and "redirect".');
    }

    // 1. Inspect metadata first to validate target, filename, and preliminary size
    const metadata = await MetadataService.inspectUrl(url, { allowLocalTest });

    if (!metadata.downloadAvailable) {
      throw new UpstreamError(`Target URL cannot be downloaded (HTTP ${metadata.httpStatus}).`);
    }

    // Check size limit from metadata before acquiring concurrency slot
    if (metadata.sizeBytes && metadata.sizeBytes > LIMITS.MAX_FILE_SIZE_BYTES) {
      throw new PayloadTooLargeError(`File size (${metadata.sizeHuman}) exceeds maximum limit of ${formatBytes(LIMITS.MAX_FILE_SIZE_BYTES)}.`);
    }

    // 2. Redirect mode
    if (mode === 'redirect') {
      // Validate that final URL is safe to expose
      return res.redirect(302, metadata.finalUrl);
    }

    // 3. Stream proxy mode
    // Acquire concurrency slot
    if (!downloadSemaphore.acquire()) {
      throw new TooManyRequestsError(`Server is currently processing maximum concurrent downloads (${LIMITS.MAX_CONCURRENT_DOWNLOADS}). Please try again momentarily.`);
    }

    let slotReleased = false;
    const releaseSlot = () => {
      if (!slotReleased) {
        slotReleased = true;
        downloadSemaphore.release();
      }
    };

    // Upstream Range forwarding if client requested byte range
    const upstreamHeaders = {};
    if (req.headers.range && metadata.supportsRanges) {
      upstreamHeaders.Range = req.headers.range;
    }

    let upstreamRes;
    try {
      upstreamRes = await SafeHttpService.getStream(metadata.finalUrl, {
        allowLocalTest,
        headers: upstreamHeaders,
        timeoutMs: LIMITS.REQUEST_TIMEOUT_MS
      });
    } catch (err) {
      releaseSlot();
      throw err;
    }

    const { status, headers: upstreamHeaderObj, stream, abortController } = upstreamRes;

    // Check upstream reported size
    const upstreamContentLength = upstreamHeaderObj['content-length'] ? parseInt(upstreamHeaderObj['content-length'], 10) : null;
    if (upstreamContentLength && upstreamContentLength > LIMITS.MAX_FILE_SIZE_BYTES) {
      stream.destroy();
      releaseSlot();
      throw new PayloadTooLargeError(`File size (${upstreamContentLength} bytes) exceeds maximum limit of ${LIMITS.MAX_FILE_SIZE_BYTES}.`);
    }

    // Set download headers
    const contentType = metadata.detectedMimeType || metadata.mimeType || 'application/octet-stream';
    const safeFilename = metadata.safeFilename.replace(/[\r\n"]/g, ''); // Prevent header injection

    res.status(status);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('Cache-Control', 'private, no-transform');

    if (upstreamContentLength) {
      res.setHeader('Content-Length', upstreamContentLength);
    }

    if (status === 206 && upstreamHeaderObj['content-range']) {
      res.setHeader('Content-Range', upstreamHeaderObj['content-range']);
      res.setHeader('Accept-Ranges', 'bytes');
    }

    // Client disconnect handler: abort upstream immediately
    req.on('close', () => {
      if (!res.writableEnded) {
        logger.info({ requestId: req.id, url }, 'Client disconnected during download stream');
        abortController.abort();
        stream.destroy();
      }
      releaseSlot();
    });

    // Real-time size limiter stream
    const sizeLimiter = new SizeEnforcementStream(LIMITS.MAX_FILE_SIZE_BYTES, (transferred) => {
      logger.warn({ requestId: req.id, transferred }, 'Download aborted: stream exceeded size limit');
      abortController.abort();
      stream.destroy();
    });

    try {
      await pipeline(stream, sizeLimiter, res);
    } catch (err) {
      releaseSlot();
      // If error occurred after headers were sent, socket is closed
      if (!res.headersSent) {
        throw err;
      }
    } finally {
      releaseSlot();
    }
  }
}

export default DownloadService;
