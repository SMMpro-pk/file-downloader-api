import path from 'path';
import yauzl from 'yauzl';
import { env } from '../config/env.js';
import { LIMITS } from '../config/limits.js';
import { SafeHttpService } from './safe-http.service.js';
import { MetadataService } from './metadata.service.js';
import {
  AppError,
  PayloadTooLargeError,
  UnsupportedFormatError,
  UpstreamError
} from '../utils/errors.js';
import { formatBytes } from '../utils/format-size.js';

export class ArchiveService {
  /**
   * Inspects a remote ZIP archive safely without executing or extracting files.
   *
   * @param {string} url
   * @param {object} [options]
   * @param {boolean} [options.allowLocalTest=false]
   */
  static async inspectArchive(url, options = {}) {
    if (!env.ENABLE_ARCHIVE_INSPECTION) {
      throw new AppError(
        'FEATURE_DISABLED',
        'Archive inspection is disabled in this deployment. Set ENABLE_ARCHIVE_INSPECTION=true to enable.',
        403
      );
    }

    const allowLocalTest = options.allowLocalTest || false;

    // 1. Inspect metadata first
    const metadata = await MetadataService.inspectUrl(url, { allowLocalTest });

    // Verify it is a ZIP archive
    if (metadata.extension !== 'zip' && metadata.fileType !== 'archive') {
      throw new UnsupportedFormatError(
        `Archive inspection only supports ZIP format. Target URL detected as "${metadata.extension || 'unknown'}".`
      );
    }

    // Check size limit before fetching
    if (metadata.sizeBytes && metadata.sizeBytes > LIMITS.MAX_ARCHIVE_INSPECT_BUFFER_BYTES) {
      throw new PayloadTooLargeError(
        `Archive size (${metadata.sizeHuman}) exceeds maximum inspectable buffer limit of ${formatBytes(LIMITS.MAX_ARCHIVE_INSPECT_BUFFER_BYTES)}.`
      );
    }

    // 2. Fetch the archive buffer with bounded limit
    const res = await SafeHttpService.request(metadata.finalUrl, {
      allowLocalTest,
      method: 'GET',
      maxBytes: LIMITS.MAX_ARCHIVE_INSPECT_BUFFER_BYTES,
      timeoutMs: LIMITS.REQUEST_TIMEOUT_MS
    });

    const buffer = res.body;
    if (!buffer || buffer.length === 0) {
      throw new UpstreamError('Received empty archive buffer from upstream server.');
    }

    // 3. Parse ZIP using yauzl fromBuffer with decodeStrings: false so invalid paths don't throw internal errors
    return new Promise((resolve, reject) => {
      yauzl.fromBuffer(buffer, { lazyEntries: true, decodeStrings: false }, (err, zipfile) => {
        if (err) {
          return reject(new UpstreamError(`Failed to parse ZIP archive: ${err.message}`));
        }

        const entries = [];
        let totalUncompressedBytes = 0;
        let totalCompressedBytes = 0;
        let hasSuspiciousEntries = false;
        const securityWarnings = [];

        zipfile.readEntry();

        zipfile.on('entry', (entry) => {
          // Check entry count limit
          if (entries.length >= LIMITS.MAX_ARCHIVE_ENTRIES) {
            securityWarnings.push(`Entry count exceeded safe display limit of ${LIMITS.MAX_ARCHIVE_ENTRIES} entries.`);
            zipfile.close();
            return finish();
          }

          const rawFileName = Buffer.isBuffer(entry.fileName)
            ? entry.fileName.toString('utf-8')
            : String(entry.fileName || '');

          let isSuspicious = false;

          // Check for path traversal attacks
          if (
            rawFileName.includes('..') ||
            rawFileName.includes('\\') ||
            rawFileName.startsWith('/') ||
            path.isAbsolute(rawFileName) ||
            rawFileName.includes('\0') ||
            /^[a-zA-Z]:/.test(rawFileName)
          ) {
            isSuspicious = true;
            hasSuspiciousEntries = true;
            securityWarnings.push(`Suspicious entry detected with path traversal sequence: "${rawFileName}"`);
          }

          const isDir = /\/$/.test(rawFileName);
          totalUncompressedBytes += entry.uncompressedSize || 0;
          totalCompressedBytes += entry.compressedSize || 0;

          // ZIP bomb checks
          if (totalUncompressedBytes > LIMITS.MAX_ARCHIVE_UNCOMPRESSED_TOTAL_BYTES) {
            securityWarnings.push(`Archive uncompressed size (${formatBytes(totalUncompressedBytes)}) exceeds safety threshold of ${formatBytes(LIMITS.MAX_ARCHIVE_UNCOMPRESSED_TOTAL_BYTES)} - potential ZIP bomb.`);
            zipfile.close();
            return finish();
          }

          let lastMod = null;
          try {
            lastMod = entry.getLastModDate() ? entry.getLastModDate().toISOString() : null;
          } catch {
            // Ignore date parsing error
          }

          entries.push({
            fileName: rawFileName,
            uncompressedSize: entry.uncompressedSize,
            compressedSize: entry.compressedSize,
            compressionMethod: entry.compressionMethod,
            isDirectory: isDir,
            lastModified: lastMod,
            isSuspicious
          });

          zipfile.readEntry();
        });

        zipfile.on('end', () => {
          finish();
        });

        zipfile.on('error', (zipErr) => {
          reject(new UpstreamError(`ZIP parsing error: ${zipErr.message}`));
        });

        function finish() {
          const ratio = totalCompressedBytes > 0
            ? Math.round((totalUncompressedBytes / totalCompressedBytes) * 10) / 10
            : 0;

          if (ratio > LIMITS.MAX_ARCHIVE_COMPRESSION_RATIO) {
            securityWarnings.push(`Abnormally high compression ratio (${ratio}:1) detected - potential ZIP bomb.`);
          }

          resolve({
            archiveUrl: metadata.finalUrl,
            format: 'zip',
            totalEntries: entries.length,
            totalCompressedBytes,
            totalCompressedHuman: formatBytes(totalCompressedBytes),
            totalUncompressedBytes,
            totalUncompressedHuman: formatBytes(totalUncompressedBytes),
            compressionRatio: `${ratio}:1`,
            hasSuspiciousEntries,
            securityWarnings,
            entries
          });
        }
      });
    });
  }
}

export default ArchiveService;
