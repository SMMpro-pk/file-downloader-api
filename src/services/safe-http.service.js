import http from 'http';
import https from 'https';
import dns from 'dns';
import { URL } from 'url';
import { LIMITS } from '../config/limits.js';
import {
  validateUrlSyntax,
  resolveAndValidateDns,
  isProhibitedIp
} from './url-validator.service.js';
import {
  UpstreamError,
  UpstreamTimeoutError,
  ForbiddenDestinationError,
  ValidationError,
  PayloadTooLargeError
} from '../utils/errors.js';
import { logger, sanitizeUrlForLogging } from '../utils/logger.js';

export class SafeHttpService {
  /**
   * Creates a custom DNS lookup function that validates the destination IP against prohibited ranges
   * and pins the socket connection to that validated IP.
   * @param {object} [options]
   * @param {boolean} [options.allowLocalTest]
   */
  static createSafeLookup(options = {}) {
    const allowLocalTest = options.allowLocalTest || false;

    return (hostname, opt, callback) => {
      let cb = callback;
      let lookupOpts = opt;
      if (typeof opt === 'function') {
        cb = opt;
        lookupOpts = {};
      }

      dns.lookup(hostname, { all: true }, (err, addresses) => {
        if (err) return cb(err);
        if (!addresses || addresses.length === 0) {
          return cb(new Error(`DNS resolution failed for ${hostname}`));
        }

        // Validate each resolved IP
        for (const record of addresses) {
          if (isProhibitedIp(record.address, { allowLocalTest })) {
            return cb(new ForbiddenDestinationError(`Destination IP ${record.address} is in a prohibited range.`));
          }
        }

        const primary = addresses[0];
        if (lookupOpts && lookupOpts.all) {
          return cb(null, addresses);
        }
        return cb(null, primary.address, primary.family);
      });
    };
  }

  /**
   * Executes a safe outbound HTTP request with SSRF validation, DNS pinning, and safe redirect recursion.
   * @param {string} initialUrl
   * @param {object} options
   * @param {'GET'|'HEAD'} [options.method='GET']
   * @param {object} [options.headers={}]
   * @param {number} [options.timeoutMs]
   * @param {number} [options.maxRedirects]
   * @param {number} [options.maxBytes]
   * @param {boolean} [options.isStream=false]
   * @param {boolean} [options.allowLocalTest=false]
   * @param {AbortSignal} [options.externalSignal]
   * @returns {Promise<{ status: number, headers: object, body?: Buffer, stream?: http.IncomingMessage, finalUrl: string, redirectCount: number }>}
   */
  static async request(initialUrl, options = {}) {
    const {
      method = 'GET',
      headers = {},
      timeoutMs = LIMITS.REQUEST_TIMEOUT_MS,
      maxRedirects = LIMITS.MAX_REDIRECTS,
      maxBytes = LIMITS.MAX_FILE_SIZE_BYTES,
      isStream = false,
      allowLocalTest = false,
      externalSignal = null
    } = options;

    let currentUrl = initialUrl;
    let redirectCount = 0;
    let currentMethod = method;

    while (redirectCount <= maxRedirects) {
      // 1. Syntactic URL validation
      const parsedUrl = validateUrlSyntax(currentUrl);

      // 2. Pre-connection DNS check to fail fast on prohibited hosts
      await resolveAndValidateDns(parsedUrl.hostname, { allowLocalTest });

      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;
      const port = parsedUrl.port ? Number(parsedUrl.port) : (isHttps ? 443 : 80);

      // Request setup
      const abortController = new AbortController();
      let timeoutId = null;

      if (timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          abortController.abort(new UpstreamTimeoutError(`Upstream connection timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }

      // Propagate external caller abort
      if (externalSignal) {
        if (externalSignal.aborted) {
          if (timeoutId) clearTimeout(timeoutId);
          throw new UpstreamError('Request aborted by caller.');
        }
        externalSignal.addEventListener('abort', () => {
          abortController.abort(new UpstreamError('Request aborted by caller.'));
        }, { once: true });
      }

      const safeLookup = SafeHttpService.createSafeLookup({ allowLocalTest });

      const reqHeaders = {
        'User-Agent': 'SMMpro-File-Downloader/1.0',
        'Accept': '*/*',
        ...headers
      };

      // Ensure Host header matches original hostname
      reqHeaders.Host = parsedUrl.host;

      const requestOptions = {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: currentMethod,
        headers: reqHeaders,
        lookup: safeLookup,
        servername: parsedUrl.hostname, // Crucial for TLS SNI hostname verification
        signal: abortController.signal
      };

      try {
        const responseResult = await new Promise((resolve, reject) => {
          const req = client.request(requestOptions, (res) => {
            resolve(res);
          });

          req.on('error', (err) => {
            if (abortController.signal.aborted) {
              const reason = abortController.signal.reason;
              if (reason instanceof UpstreamTimeoutError) {
                return reject(reason);
              }
              return reject(new UpstreamTimeoutError(`Upstream connection timed out after ${timeoutMs}ms.`));
            }
            if (err instanceof ForbiddenDestinationError) {
              return reject(err);
            }
            return reject(new UpstreamError(`Upstream network error: ${err.message}`));
          });

          req.end();
        });

        const status = responseResult.statusCode;
        const resHeaders = responseResult.headers;

        // Check for redirects (301, 302, 303, 307, 308)
        if ([301, 302, 303, 307, 308].includes(status) && resHeaders.location) {
          if (timeoutId) clearTimeout(timeoutId);
          responseResult.destroy(); // Destroy socket for this redirect

          redirectCount++;
          if (redirectCount > maxRedirects) {
            throw new ValidationError(`Redirect limit exceeded. Maximum permitted redirects: ${maxRedirects}.`);
          }

          // Resolve next URL against currentUrl
          let nextUrl;
          try {
            nextUrl = new URL(resHeaders.location, currentUrl).toString();
          } catch {
            throw new ValidationError(`Invalid redirect location header: "${resHeaders.location}".`);
          }

          logger.debug(
            { from: sanitizeUrlForLogging(currentUrl), to: sanitizeUrlForLogging(nextUrl), hop: redirectCount },
            'Following safe HTTP redirect'
          );

          currentUrl = nextUrl;
          // Status 303 requires GET method
          if (status === 303) {
            currentMethod = 'GET';
          }
          continue; // Loop for next hop
        }

        // If streaming requested, return response stream directly with abort handler
        if (isStream) {
          if (timeoutId) clearTimeout(timeoutId);
          return {
            status,
            headers: resHeaders,
            stream: responseResult,
            finalUrl: currentUrl,
            redirectCount,
            abortController
          };
        }

        // For non-streaming requests: read body up to maxBytes
        const chunks = [];
        let totalBytes = 0;

        await new Promise((resolve, reject) => {
          responseResult.on('data', (chunk) => {
            totalBytes += chunk.length;
            if (maxBytes > 0 && totalBytes > maxBytes) {
              responseResult.destroy();
              if (timeoutId) clearTimeout(timeoutId);
              return reject(new PayloadTooLargeError(`Response body exceeded limit of ${maxBytes} bytes.`));
            }
            chunks.push(chunk);
          });

          responseResult.on('end', () => {
            if (timeoutId) clearTimeout(timeoutId);
            resolve();
          });

          responseResult.on('error', (err) => {
            if (timeoutId) clearTimeout(timeoutId);
            reject(new UpstreamError(`Error reading response body: ${err.message}`));
          });
        });

        return {
          status,
          headers: resHeaders,
          body: Buffer.concat(chunks),
          finalUrl: currentUrl,
          redirectCount
        };
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        throw err;
      }
    }

    throw new ValidationError(`Too many redirects. Exceeded maximum of ${maxRedirects}.`);
  }

  /**
   * Sends a safe HEAD request.
   */
  static async head(url, options = {}) {
    return SafeHttpService.request(url, { ...options, method: 'HEAD', maxBytes: 0 });
  }

  /**
   * Fetches an initial probe buffer (default 16KB) to inspect binary signatures.
   * Attempts an HTTP Range request first; if range is not supported, reads only the probe size.
   */
  static async getProbeBuffer(url, options = {}) {
    const probeSize = options.probeSize || LIMITS.PROBE_BUFFER_SIZE_BYTES;
    const allowLocalTest = options.allowLocalTest || false;

    // First try a Range request
    try {
      const res = await SafeHttpService.request(url, {
        ...options,
        method: 'GET',
        headers: {
          ...options.headers,
          Range: `bytes=0-${probeSize - 1}`
        },
        maxBytes: probeSize,
        allowLocalTest
      });

      const supportsRanges = res.status === 206 || res.headers['accept-ranges'] === 'bytes';
      return {
        ...res,
        supportsRanges
      };
    } catch (err) {
      // If server rejected Range with 416 Range Not Satisfiable or similar, retry with limited plain GET
      if (err instanceof PayloadTooLargeError) {
        // If the server ignored Range and sent full body > maxBytes, we can stream and grab just probeSize!
        const streamRes = await SafeHttpService.request(url, {
          ...options,
          method: 'GET',
          isStream: true,
          allowLocalTest
        });

        const chunks = [];
        let bytesRead = 0;

        await new Promise((resolve) => {
          streamRes.stream.on('data', (chunk) => {
            const needed = probeSize - bytesRead;
            if (needed <= 0) {
              streamRes.stream.destroy();
              return resolve();
            }
            if (chunk.length > needed) {
              chunks.push(chunk.subarray(0, needed));
              bytesRead += needed;
              streamRes.stream.destroy();
              return resolve();
            }
            chunks.push(chunk);
            bytesRead += chunk.length;
            if (bytesRead >= probeSize) {
              streamRes.stream.destroy();
              return resolve();
            }
          });

          streamRes.stream.on('end', resolve);
          streamRes.stream.on('close', resolve);
          streamRes.stream.on('error', resolve);
        });

        const supportsRanges = streamRes.headers['accept-ranges'] === 'bytes';
        return {
          status: streamRes.status,
          headers: streamRes.headers,
          body: Buffer.concat(chunks),
          finalUrl: streamRes.finalUrl,
          redirectCount: streamRes.redirectCount,
          supportsRanges
        };
      }
      throw err;
    }
  }

  /**
   * Fetches HTML content up to a bounded maximum page size (default 2MB).
   */
  static async getHtml(url, options = {}) {
    const maxBytes = options.maxBytes || LIMITS.MAX_HTML_PAGE_SIZE_BYTES;
    const timeoutMs = options.timeoutMs || LIMITS.EXTRACT_TIMEOUT_MS;

    const res = await SafeHttpService.request(url, {
      ...options,
      method: 'GET',
      headers: {
        ...options.headers,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeoutMs,
      maxBytes
    });

    const htmlText = res.body ? res.body.toString('utf-8') : '';
    return {
      status: res.status,
      headers: res.headers,
      html: htmlText,
      finalUrl: res.finalUrl,
      redirectCount: res.redirectCount
    };
  }

  /**
   * Obtains a streaming response for downloading with abort management.
   */
  static async getStream(url, options = {}) {
    return SafeHttpService.request(url, {
      ...options,
      method: 'GET',
      isStream: true
    });
  }
}

export default SafeHttpService;
