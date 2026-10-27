import { env } from '../config/env.js';
import { LIMITS } from '../config/limits.js';
import { SUPPORTED_FORMATS, FILE_CATEGORIES } from '../config/registry.js';
import { formatBytes } from '../utils/format-size.js';

export function getHealth(req, res) {
  return res.jsonEnvelope({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    brand: 'SMMpro',
    service: 'SMMpro File Downloader API'
  });
}

export function getVersion(req, res) {
  return res.jsonEnvelope({
    service: 'SMMpro File Downloader API',
    version: '1.0.0',
    nodeVersion: process.version,
    environment: env.NODE_ENV,
    brand: {
      name: 'SMMpro',
      website: 'https://smmpro.pk/'
    }
  });
}

export function getPlatforms(req, res) {
  const formatsList = Object.entries(SUPPORTED_FORMATS).map(([ext, info]) => ({
    extension: ext,
    category: info.category,
    description: info.description,
    primaryMime: info.mimes[0]
  }));

  return res.jsonEnvelope({
    categories: Object.values(FILE_CATEGORIES),
    formats: formatsList,
    limits: {
      maxFileSizeBytes: LIMITS.MAX_FILE_SIZE_BYTES,
      maxFileSizeHuman: formatBytes(LIMITS.MAX_FILE_SIZE_BYTES),
      maxExtractedLinks: LIMITS.MAX_EXTRACTED_LINKS,
      maxConcurrentDownloads: LIMITS.MAX_CONCURRENT_DOWNLOADS,
      detectionRateLimitPerMin: LIMITS.DETECTION_RATE_LIMIT,
      downloadRateLimitPerMin: LIMITS.DOWNLOAD_RATE_LIMIT
    },
    features: {
      directFileDetection: true,
      metadataInspection: true,
      streamDownloadProxy: true,
      redirectDownload: true,
      rangeRequests: true,
      linkExtraction: true,
      archiveInspection: env.ENABLE_ARCHIVE_INSPECTION
    }
  });
}

export default {
  getHealth,
  getVersion,
  getPlatforms
};
