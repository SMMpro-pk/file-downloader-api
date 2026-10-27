import * as cheerio from 'cheerio';
import { SafeHttpService } from './safe-http.service.js';
import { validateUrlSyntax, isProhibitedIp } from './url-validator.service.js';
import { extractExtension } from '../utils/filename.js';
import { getFormatInfoByExtension } from '../config/registry.js';
import { LIMITS } from '../config/limits.js';
import { logger } from '../utils/logger.js';

export class LinkExtractorService {
  /**
   * Extracts downloadable file candidate links from a target webpage.
   *
   * @param {string} pageUrl
   * @param {object} [options]
   * @param {number} [options.limit=50]
   * @param {boolean} [options.allowLocalTest=false]
   */
  static async extractLinks(pageUrl, options = {}) {
    const limit = Math.min(options.limit || LIMITS.MAX_EXTRACTED_LINKS, LIMITS.MAX_EXTRACTED_LINKS);
    const allowLocalTest = options.allowLocalTest || false;

    // 1. Fetch HTML safely with SSRF protection and bounded size
    const { html, finalUrl } = await SafeHttpService.getHtml(pageUrl, {
      allowLocalTest,
      timeoutMs: LIMITS.EXTRACT_TIMEOUT_MS,
      maxBytes: LIMITS.MAX_HTML_PAGE_SIZE_BYTES
    });

    const $ = cheerio.load(html);

    // Check if page specifies a <base href="...">
    let baseUrl = finalUrl;
    const baseHref = $('base[href]').attr('href');
    if (baseHref) {
      try {
        baseUrl = new URL(baseHref, finalUrl).toString();
      } catch {
        // Fall back to finalUrl if invalid base
      }
    }

    const seenUrls = new Set();
    const candidateLinks = [];

    // Select elements that typically link to downloadable files
    // <a>, <link>, <area>, <source>
    $('a[href], area[href], [download]').each((_, el) => {
      if (candidateLinks.length >= limit) return false;

      const $el = $(el);
      const rawHref = $el.attr('href') || $el.attr('download');
      if (!rawHref) return;

      const trimmedHref = rawHref.trim();
      // Skip non-http schemes and intra-page anchors
      if (
        !trimmedHref ||
        trimmedHref.startsWith('#') ||
        trimmedHref.startsWith('javascript:') ||
        trimmedHref.startsWith('mailto:') ||
        trimmedHref.startsWith('tel:') ||
        trimmedHref.startsWith('data:')
      ) {
        return;
      }

      // Resolve relative URLs against baseUrl
      let resolvedUrl;
      try {
        resolvedUrl = new URL(trimmedHref, baseUrl).toString();
      } catch {
        return; // Skip unparseable URL
      }

      // Syntactic and SSRF scheme check
      let parsedCandidate;
      try {
        parsedCandidate = validateUrlSyntax(resolvedUrl);
      } catch {
        return; // Skip invalid or forbidden schemes
      }

      // Check for direct private IP in hostname
      if (isProhibitedIp(parsedCandidate.hostname, { allowLocalTest })) {
        return; // Skip prohibited private host
      }

      // Deduplicate
      if (seenUrls.has(resolvedUrl)) {
        return;
      }
      seenUrls.add(resolvedUrl);

      // Extract label
      const textLabel = $el.text().replace(/\s+/g, ' ').trim();
      const titleAttr = $el.attr('title') || '';
      const ariaLabel = $el.attr('aria-label') || '';
      const downloadAttr = $el.attr('download');
      const label = textLabel || ariaLabel || titleAttr || downloadAttr || parsedCandidate.pathname.split('/').pop() || 'Download Link';

      // Infer extension and category from URL or download attribute
      const ext = extractExtension(downloadAttr) || extractExtension(parsedCandidate.pathname);
      const formatInfo = getFormatInfoByExtension(ext);

      candidateLinks.push({
        url: resolvedUrl,
        label: label.substring(0, 150),
        extension: ext,
        category: formatInfo ? formatInfo.category : 'unknown',
        inferredFormat: formatInfo ? formatInfo.description : (ext ? `${ext.toUpperCase()} File` : 'Unknown'),
        hasDownloadAttribute: Boolean($el.attr('download'))
      });
    });

    logger.debug({ pageUrl, candidatesFound: candidateLinks.length }, 'Extracted downloadable candidates');

    return {
      pageUrl: finalUrl,
      totalCandidates: candidateLinks.length,
      returnedCount: candidateLinks.length,
      links: candidateLinks
    };
  }
}

export default LinkExtractorService;
