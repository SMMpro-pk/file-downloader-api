import { env } from '../config/env.js';

export class UrlDiscoveryService {
  /**
   * Discovers the public base URL based on explicit environment configuration
   * or known cloud provider environment variables.
   *
   * Security constraint: Never derives origin from untrusted Host or forwarding headers.
   *
   * @returns {string|null} Origin URL without trailing slash (e.g. "https://api.smmpro.pk") or null
   */
  static discoverPublicBaseUrl() {
    // 1. Explicitly configured PUBLIC_BASE_URL
    if (env.PUBLIC_BASE_URL) {
      return env.PUBLIC_BASE_URL;
    }

    // 2. Render.com
    if (process.env.RENDER_EXTERNAL_URL) {
      try {
        const u = new URL(process.env.RENDER_EXTERNAL_URL.trim());
        return u.origin;
      } catch {
        // Ignore invalid URL
      }
    }

    // 3. Railway.app
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
      const domain = process.env.RAILWAY_PUBLIC_DOMAIN.trim().replace(/^https?:\/\//, '');
      return `https://${domain}`;
    }
    if (process.env.RAILWAY_STATIC_URL) {
      const domain = process.env.RAILWAY_STATIC_URL.trim().replace(/^https?:\/\//, '');
      return `https://${domain}`;
    }

    // 4. Fly.io
    if (process.env.FLY_APP_NAME) {
      return `https://${process.env.FLY_APP_NAME.trim()}.fly.dev`;
    }

    // 5. Vercel
    if (process.env.VERCEL_URL) {
      const domain = process.env.VERCEL_URL.trim().replace(/^https?:\/\//, '');
      return `https://${domain}`;
    }

    // 6. Heroku
    if (process.env.HEROKU_APP_NAME) {
      return `https://${process.env.HEROKU_APP_NAME.trim()}.herokuapp.com`;
    }

    // 7. Koyeb
    if (process.env.KOYEB_PUBLIC_DOMAIN) {
      const domain = process.env.KOYEB_PUBLIC_DOMAIN.trim().replace(/^https?:\/\//, '');
      return `https://${domain}`;
    }

    // 8. Configurable local development fallback
    if (env.NODE_ENV !== 'production') {
      if (env.LOCAL_BASE_URL) {
        return env.LOCAL_BASE_URL;
      }
      return `http://localhost:${env.PORT}`;
    }

    // If production and cannot be verified from provider or env
    return null;
  }

  /**
   * Determines the operational deployment status.
   * @returns {'live'|'local_development'|'configuration_required'}
   */
  static getDeploymentStatus() {
    const publicUrl = UrlDiscoveryService.discoverPublicBaseUrl();

    if (env.NODE_ENV !== 'production') {
      return 'local_development';
    }

    if (publicUrl) {
      return 'live';
    }

    return 'configuration_required';
  }

  /**
   * Generates public configuration metadata for frontend integration and dashboards.
   * Never leaks secrets or API keys.
   */
  static getPublicConfig() {
    const publicBaseUrl = UrlDiscoveryService.discoverPublicBaseUrl();
    const deploymentStatus = UrlDiscoveryService.getDeploymentStatus();
    const apiBasePath = env.API_BASE_PATH || '/api/v1';

    return {
      appName: 'SMMpro File Downloader',
      brand: {
        name: 'SMMpro'
      },
      deploymentStatus,
      publicBaseUrl,
      apiBaseUrl: publicBaseUrl ? `${publicBaseUrl}${apiBasePath}` : apiBasePath,
      apiBasePath,
      docsUrl: publicBaseUrl ? `${publicBaseUrl}/api/docs` : '/api/docs',
      healthUrl: publicBaseUrl ? `${publicBaseUrl}${apiBasePath}/health` : `${apiBasePath}/health`,
      readyUrl: publicBaseUrl ? `${publicBaseUrl}${apiBasePath}/ready` : `${apiBasePath}/ready`,
      testPageUrl: publicBaseUrl ? `${publicBaseUrl}/test` : '/test',
      apiKeyRequired: env.API_KEY_REQUIRED,
      configurationHelp: publicBaseUrl
        ? null
        : 'Public URL not automatically detected. To expose this API to external clients, configure the PUBLIC_BASE_URL environment variable in your hosting provider\'s dashboard (e.g. PUBLIC_BASE_URL=https://your-assigned-domain.com).'
    };
  }
}

export default UrlDiscoveryService;
