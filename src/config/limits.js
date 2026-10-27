import { env } from './env.js';

export const LIMITS = {
  // Network timeouts
  REQUEST_TIMEOUT_MS: env.REQUEST_TIMEOUT_MS,
  EXTRACT_TIMEOUT_MS: env.EXTRACT_TIMEOUT_MS,
  MAX_REDIRECTS: env.MAX_REDIRECTS,

  // File size thresholds
  MAX_FILE_SIZE_BYTES: env.MAX_FILE_SIZE_BYTES,
  MAX_REQUEST_BODY_BYTES: env.MAX_REQUEST_BODY_BYTES,

  // Stream probe size for binary signature detection (e.g. 16 KB is more than enough for signatures)
  PROBE_BUFFER_SIZE_BYTES: 16 * 1024,

  // Webpage link extractor limits
  MAX_EXTRACTED_LINKS: env.MAX_EXTRACTED_LINKS,
  MAX_HTML_PAGE_SIZE_BYTES: 2 * 1024 * 1024, // 2 MB limit for parsed HTML to prevent memory exhaustion

  // Concurrency & Rate limits
  MAX_CONCURRENT_DOWNLOADS: env.MAX_CONCURRENT_DOWNLOADS,
  DETECTION_RATE_LIMIT: env.DETECTION_RATE_LIMIT,
  DOWNLOAD_RATE_LIMIT: env.DOWNLOAD_RATE_LIMIT,

  // Archive inspection safety limits (ZIP bomb defense)
  MAX_ARCHIVE_INSPECT_BUFFER_BYTES: 50 * 1024 * 1024, // 50 MB
  MAX_ARCHIVE_ENTRIES: 1000,
  MAX_ARCHIVE_UNCOMPRESSED_TOTAL_BYTES: 250 * 1024 * 1024, // 250 MB
  MAX_ARCHIVE_COMPRESSION_RATIO: 100, // Ratio of uncompressed to compressed size alert threshold

  // Stream socket inactive timeout (60 seconds)
  STREAM_SOCKET_TIMEOUT_MS: 60000
};

export default LIMITS;
