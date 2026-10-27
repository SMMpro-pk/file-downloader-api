# SMMpro File Downloader API

<div align="center">

![SMMpro Brand](https://smmpro.pk/favicon.ico)

**Enterprise-Grade File Detection, Metadata Inspection, Link Discovery, and Secure Streaming Proxy**

[![Node.js Version](https://img.shields.io/badge/Node.js-22%20LTS-339933?logo=node.js)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-4.21-000000?logo=express)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red)](#)
[![Tests](https://img.shields.io/badge/Tests-71%20Passing-brightgreen?logo=vitest)](https://vitest.dev/)
[![Security](https://img.shields.io/badge/SSRF%20Protection-Hardened-blue)](#security-architecture)

Official Website: [https://smmpro.pk/](https://smmpro.pk/)  
Product: **SMMpro File Downloader API**

</div>

---

## 1. Project Overview

The **SMMpro File Downloader API** is a high-performance, production-ready backend service designed for [SMMpro](https://smmpro.pk/) to inspect remote URLs, accurately determine real file formats via binary magic-byte signatures, extract structured file metadata, discover downloadable candidate links from webpage HTML, and securely stream downloads to client applications without buffering files to disk.

Built with **Node.js 22 LTS** in pure **ES Modules**, this service provides a robust REST API designed to integrate seamlessly with the SMMpro website and video downloader suite. It operates completely independently without requiring paid third-party file inspection or scanning APIs.

---

## 2. Core Capabilities & Architecture

- **Public Homepage (`GET /`) & Live Testing Dashboard (`GET /test`)**: Modern SaaS interface branded with royal purple (`#6552E6`), lavender (`#E9E5FF`), and navy styling. Allows real-time URL detection, file metadata inspection, and streaming file downloads directly through the deployed backend.
- **Automatic Live URL Discovery (`GET /api/v1/config/public`)**: Auto-discovers public origin from provider environment variables (Render, Railway, Fly.io, Vercel) or explicit `PUBLIC_BASE_URL`. Clearly displays and provides copy buttons for the API base URL used by frontend applications.
- **Same-Origin Backend-for-Frontend Proxy (`/api/internal/*`)**: Built-in test dashboard proxy that enforces same-origin validation, allowing visitors to test file operations without exposing permanent server-side API keys in client JavaScript.
- **Direct URL File Detection**: Inspects remote URLs without downloading entire files. Employs bounded Range requests (initial 16 KB) and HEAD fallback to read binary signatures.
- **Binary Format Verification (`file-type`)**: Detects actual file format from binary headers, avoiding deceptive or spoofed file extensions.
- **Comprehensive File Type Registry**: Supports archives (ZIP, RAR, 7Z, TAR, GZ, BZ2, XZ), documents (PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, EPUB), images (JPG, PNG, WEBP, GIF, SVG, TIFF, BMP, AVIF), audio (MP3, WAV, FLAC, AAC, M4A, OGG, OPUS), video (MP4, WEBM, MOV, MKV, AVI, MPEG), and software packages (APK, EXE, MSI, DMG, ISO, DEB, RPM).
- **Webpage Downloadable-Link Extractor**: Parses server-rendered HTML using `cheerio`, discovers candidate files from `<a>`, `<area>`, and `[download]` attributes, resolves relative URLs, and filters out private/prohibited hosts.
- **Secure Streaming Proxy**: Streams files directly using Node.js backpressure pipelines with sanitized `Content-Disposition: attachment`, real-time size limit enforcement, Range forwarding, and client disconnect abort propagation.
- **Container Health & Readiness (`/api/v1/health`, `/api/v1/ready`)**: Lightweight health checks and readiness monitoring that distinguish process startup from public domain availability.
- **Zero-Storage Footprint**: Files are proxied in-flight with zero permanent disk footprint.
- **Optional Archive Inspector**: Non-extracting ZIP entry inspection using `yauzl` with ZIP bomb expansion defense and path traversal detection.
- **Hardened SSRF & DNS Rebinding Defenses**: Socket-level IP pinning, loopback/private/link-local/metadata CIDR blocklist, and redirect re-validation.

---

## 3. Technology Stack

| Component | Technology | Version | Purpose |
|:---|:---|:---|:---|
| **Runtime** | Node.js | `22.x LTS` / `24.x` | Modern asynchronous JavaScript execution environment |
| **Framework** | Express.js | `^4.21.2` | REST API routing and middleware pipeline |
| **Module System** | ECMAScript Modules | ESM (`"type": "module"`) | Standard native ES module architecture |
| **Validation** | Zod | `^4.6.7` | Strict runtime request and environment validation |
| **Security Headers** | Helmet | `^8.0.0` | Comprehensive HTTP security headers (CSP, HSTS, etc.) |
| **CORS** | cors | `^2.8.5` | Configurable cross-origin origin allowlist |
| **Rate Limiting** | express-rate-limit | `^7.5.0` | IP-based request throttling with standardized error envelopes |
| **Binary Detection** | file-type | `^22.2.0` | Identification of binary magic signatures |
| **Dispositions** | content-disposition | `^0.5.4` | RFC 6266 / RFC 5987 filename parsing |
| **IP Validation** | ipaddr.js | `^2.2.0` | IPv4 & IPv6 CIDR subnet matching for SSRF protection |
| **HTML Parser** | cheerio | `^1.0.0` | Fast, lightweight server-side DOM parsing |
| **ZIP Inspection** | yauzl | `^3.2.0` | Random-access Central Directory ZIP reader |
| **Logging** | pino & pino-http | `^9.6.0` / `^10.4.0` | High-throughput structured JSON logging with redaction |
| **Testing** | vitest & supertest | `^5.0.5` / `^7.0.0` | Automated unit, integration, and security test suite |
| **Documentation** | swagger-ui-express & yaml | `^5.0.1` / `^2.7.0` | Interactive OpenAPI 3.0 documentation |

---

## 4. Easy Deployment (One-Click & GitHub-Integrated)

Deploy the SMMpro File Downloader API in minutes with zero manual server configuration. The application binds to `0.0.0.0:${PORT:-3000}`, supports Docker containerization without requiring a `.env` file, automatically discovers its public origin, and includes an interactive Live Testing Dashboard at `/test`.

### 1. Instant Docker Quickstart (Zero Configuration)
You do NOT need to create a `.env` file. Clone and run immediately with sensible defaults:
```bash
git clone https://github.com/SMMpro-pk/file-downloader-api.git
cd file-downloader-api

# Start immediately in Docker (zero manual configuration required)
docker compose up -d --build
```
Open [http://localhost:3000](http://localhost:3000) for the API overview or [http://localhost:3000/test](http://localhost:3000/test) to test URL inspection, metadata extraction, webpage link discovery, and downloads live in your browser.

### 2. Zero-Configuration vs. Optional Host Settings

| Feature / Setting | Zero Configuration (Default) | Optional Host Override | Description |
|:---|:---|:---|:---|
| **Port Binding** | `PORT=3000` on `0.0.0.0` | `process.env.PORT` | Dynamically adapts to hosting provider port assignment |
| **Authentication** | `API_KEY_REQUIRED=false` (Public API) | `API_KEY_REQUIRED=true`<br>`API_KEY=<secret>` | If required without a key supplied, a stable 32-byte key is automatically generated and persisted in `data/.api-key` (mode `0o600`) |
| **Public URL Discovery** | Auto-detected for Render, Railway, Fly.io, Vercel, Heroku, Koyeb | `PUBLIC_BASE_URL=https://your-domain.com` | Override for custom VPS, domains, or reverse proxies without recognized cloud hostname envs |
| **CORS Policy** | `CORS_ORIGINS=*` (Universal access) | `CORS_ORIGINS=https://smmpro.pk,https://app.smmpro.pk` | Restricts API access to specific approved origins |
| **Directory Initialization** | `data/` & `tmp/` auto-created | Mounted Docker volumes (`smmpro-data`, `smmpro-tmp`) | Preserves runtime data and cached keys without user intervention |
| **SSRF & Private IP Shield** | Fully Active | Cannot be bypassed in production | Blocks loopback, RFC 1918 private subnets, cloud metadata (169.254.169.254) |
| **Interactive Test Dashboard** | Live at `/test` | Same-origin backend proxy (`/api/internal/*`) | Allows live testing of file inspection, metadata, webpage link extraction, and download stream |

### 3. Deploy via GitHub-Integrated Hosting Providers

#### Option A: Render.com (One-Click Blueprint)
1. In [Render Dashboard](https://dashboard.render.com/), click **New +** -> **Blueprint**.
2. Connect your repository. Render automatically reads [`render.yaml`](render.yaml).
3. Confirm environment variables (`API_KEY`).
4. Click **Apply**. Render builds the service and executes health checks on `/api/v1/health`.

#### Option B: Railway.app
1. In [Railway](https://railway.app/), click **New Project** -> **Deploy from GitHub repo**.
2. Select your repository. Railway detects [`Dockerfile`](Dockerfile) and [`railway.json`](railway.json).
3. Under **Variables**, add `NODE_ENV=production`, `API_KEY_REQUIRED=true`, and `API_KEY`.
4. Under **Settings** -> **Networking**, click **Generate Domain**.

#### Option C: Fly.io
1. Authenticate with `flyctl auth login`.
2. Launch using [`fly.toml`](fly.toml):
   ```bash
   fly launch --copy-config
   fly secrets set API_KEY="your_secret_key" API_KEY_REQUIRED="true"
   fly deploy
   ```

### 4. Find Your Public Deployment URL
When deployment completes:
- **Render**: Listed at the top of your service dashboard (e.g., `https://smmpro-api.onrender.com`).
- **Railway**: Listed under **Networking** (e.g., `https://smmpro-api.up.railway.app`).
- **Fly.io**: Derived as `https://<fly-app-name>.fly.dev`.

### 5. Configure `PUBLIC_BASE_URL` When Necessary
The service auto-detects `RENDER_EXTERNAL_URL`, `RAILWAY_PUBLIC_DOMAIN`, `RAILWAY_STATIC_URL`, `FLY_APP_NAME`, `VERCEL_URL`, `HEROKU_APP_NAME`, and `KOYEB_PUBLIC_DOMAIN`.
If using a custom domain or reverse proxy (Cloudflare, Nginx, AWS ALB), explicitly set:
```bash
PUBLIC_BASE_URL=https://api.yourdomain.com
```

### 6. Obtain the Live API Base URL
Query the public configuration endpoint:
```bash
curl -sS https://YOUR_PUBLIC_DOMAIN/api/v1/config/public
```
The response returns:
```json
{
  "success": true,
  "data": {
    "appName": "SMMpro File Downloader",
    "publicBaseUrl": "https://YOUR_PUBLIC_DOMAIN",
    "apiBaseUrl": "https://YOUR_PUBLIC_DOMAIN/api/v1",
    "docsUrl": "https://YOUR_PUBLIC_DOMAIN/api/docs",
    "healthUrl": "https://YOUR_PUBLIC_DOMAIN/api/v1/health",
    "testPageUrl": "https://YOUR_PUBLIC_DOMAIN/test",
    "apiKeyRequired": true
  }
}
```
Copy `apiBaseUrl` directly into your frontend application!

### 7. Open the Testing Dashboard
Open `https://YOUR_PUBLIC_DOMAIN/test` in any browser:
- Test real URL detection and format verification.
- Inspect true binary magic bytes vs declared MIME types.
- Safely test streaming file downloads through the backend.
- Does **not** expose your server-side `API_KEY` in browser JavaScript (protected via same-origin backend proxy).

### 8. Test Detection Using curl
```bash
curl -i https://YOUR_PUBLIC_DOMAIN/api/v1/health
```

```bash
curl -sS https://YOUR_PUBLIC_DOMAIN/api/v1/config/public
```

```bash
curl -X POST "https://YOUR_PUBLIC_DOMAIN/api/v1/files/info" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"url":"https://example.com/files/sample.zip"}'
```

### 9. Test Downloads Using curl
```bash
curl -fL -X POST \
  "https://YOUR_PUBLIC_DOMAIN/api/v1/download" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"url":"https://example.com/files/sample.zip","mode":"stream"}' \
  -o sample.zip
```

### 10. Diagnose Failed Health Checks
If health checks fail on deployment:
1. Verify the process is listening on `0.0.0.0` (not `127.0.0.1` only).
2. Check provider logs for startup validation errors (e.g., Zod schema rejection on invalid environment variables).
3. Query the readiness endpoint locally or via container exec:
   ```bash
   curl -i http://127.0.0.1:3000/api/v1/ready
   ```
4. Verify port binding: ensure the application reads `process.env.PORT` assigned by the hosting provider.

### 11. Configure Custom Domain & HTTPS
1. In your DNS provider (e.g. Cloudflare), create a `CNAME` pointing `api.yourdomain.com` to your provider host.
2. In your hosting dashboard, add the custom domain and verify SSL provisioning.
3. Update `PUBLIC_BASE_URL=https://api.yourdomain.com` and `CORS_ORIGINS`.

### 12. Rotate API Keys
1. Generate a new secret: `openssl rand -hex 32`.
2. Update `API_KEY` in your hosting dashboard variables.
3. Trigger a zero-downtime rolling reload.
4. Update frontend client configurations to the new key.

### 13. Redeploy After Pushing Changes
Whenever changes are pushed to `main` (or configured deployment branch):
- Render, Railway, and Fly.io automatically trigger builds.
- Docker containers run health checks prior to cutting over traffic.
- Active streaming downloads are allowed up to 15 seconds to drain before graceful shutdown.

---

## 5. Local Quickstart Guide

### Prerequisites
- Node.js 22 LTS or Node.js 20 LTS (`node -v`)
- npm 10+ (`npm -v`)
- (Optional) Docker & Docker Compose

### Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/smmpro/smmpro-file-downloader-api.git
   cd smmpro-file-downloader-api
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   *(For local testing without requiring an API key, set `API_KEY_REQUIRED=false` in `.env`)*

4. **Start development server:**
   ```bash
   npm run dev
   ```
   The API will listen at `http://localhost:3000`.

5. **Access Interactive Swagger Docs:**
   Open your browser to: [`http://localhost:3000/api/docs`](http://localhost:3000/api/docs)

---

## 6. Configuration (`.env`)

All settings are validated with Zod at startup. Invalid configurations trigger a clean, non-sensitive fatal startup error.

```ini
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# Authentication
API_KEY_REQUIRED=true
API_KEY=replace_with_a_long_random_secret_at_least_32_chars_long

# CORS & Networking
CORS_ORIGINS=http://localhost:3000,https://smmpro.pk
TRUST_PROXY=false
REQUEST_TIMEOUT_MS=10000
EXTRACT_TIMEOUT_MS=15000
MAX_REDIRECTS=5

# Thresholds & Constraints
MAX_EXTRACTED_LINKS=50
MAX_FILE_SIZE_BYTES=1073741824      # 1 GB
MAX_REQUEST_BODY_BYTES=32768        # 32 KB
MAX_CONCURRENT_DOWNLOADS=5

# Rate Limits (Requests Per Minute)
DETECTION_RATE_LIMIT=30
DOWNLOAD_RATE_LIMIT=10

# Logging & Features
LOG_LEVEL=info
ENABLE_ARCHIVE_INSPECTION=false
```

---

## 7. Complete curl API Testing Guide

### A. Health & System Checks

#### Health Endpoint
**Linux / macOS (Bash):**
```bash
curl -i http://localhost:3000/api/v1/health
```
**Windows PowerShell:**
```powershell
curl.exe -i http://localhost:3000/api/v1/health
```
**Windows CMD:**
```cmd
curl -i http://localhost:3000/api/v1/health
```

#### Version Endpoint
```bash
curl -i http://localhost:3000/api/v1/version
```

#### Platforms & Registry Endpoint
```bash
curl -i http://localhost:3000/api/v1/platforms
```

---

### B. Direct File Detection & Inspection

#### Detect File
```bash
curl -X POST "http://localhost:3000/api/v1/files/detect" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"url":"https://example.com/files/archive.zip"}'
```

#### Get Detailed File Information
```bash
curl -X POST "http://localhost:3000/api/v1/files/info" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"url":"https://example.com/files/archive.zip"}'
```

#### Full Technical Inspection & Security Warnings
```bash
curl -X POST "http://localhost:3000/api/v1/files/inspect" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"url":"https://example.com/files/archive.zip"}'
```

---

### C. Webpage Link Extractor

Extract candidate downloadable links from any public webpage:
```bash
curl -X POST "http://localhost:3000/api/v1/extract-links" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"url":"https://example.com/downloads","limit":25}'
```

---

### D. Secure File Downloading

#### Stream Proxy Download (POST)
Streams binary file data with sanitized `Content-Disposition: attachment; filename="..."`:
```bash
curl -fL -X POST "http://localhost:3000/api/v1/download" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"url":"https://example.com/files/archive.zip","mode":"stream"}' \
  -o archive.zip
```

#### Stream Download with Real-Time Progress Indicator
```bash
curl -# -fL -X POST "http://localhost:3000/api/v1/download" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"url":"https://example.com/files/archive.zip","mode":"stream"}' \
  -o archive.zip
```

#### Redirect Mode Download
Returns HTTP `302 Found` to the validated original URL:
```bash
curl -i -X POST "http://localhost:3000/api/v1/download" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"url":"https://example.com/files/archive.zip","mode":"redirect"}'
```

#### Browser GET Download
Direct URL download for hyperlinks and browser integration:
```bash
curl -fL "http://localhost:3000/api/v1/download?url=https%3A%2F%2Fexample.com%2Ffiles%2Farchive.zip&mode=stream" \
  -H "X-API-Key: YOUR_API_KEY" \
  -o archive.zip
```

---

### E. Archive Inspection

Inspect ZIP files without extracting or executing contents:
```bash
curl -X POST "http://localhost:3000/api/v1/archive/inspect" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"url":"https://example.com/files/archive.zip"}'
```

---

## 8. Security Architecture

Detailed documentation is available in [`docs/SECURITY.md`](docs/SECURITY.md).

### Summary of Defenses:
1. **SSRF Blocking**: Blocks `127.0.0.0/8`, `169.254.0.0/16` (AWS/Azure/GCP metadata), `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `100.64.0.0/10` (CGNAT), `::1`, `fe80::/10`, `fc00::/7`, and IPv4-mapped IPv6 (`::ffff:127.0.0.1`).
2. **DNS Rebinding Prevention**: Outbound sockets use custom lookup handlers that validate resolved addresses and pin the socket directly to the validated IP while retaining TLS SNI verification.
3. **Redirect Hop Verification**: Every redirect hop is re-validated through the DNS & IP filter before connection.
4. **Filename Sanitization**: Traversal paths (`../`), null bytes, illegal filesystem characters (`<>:"/\|?*`), and Windows reserved device names (`CON`, `PRN`, `AUX`, `NUL`) are neutralized.
5. **ZIP Bomb Protection**: Central Directory inspection with expansion ratio monitoring (alerts on > 100:1), entry count caps (1,000), and max uncompressed limits (250 MB).
6. **Constant-Time Auth**: Ephemeral HMAC timing-safe secret comparisons.
7. **Privacy & Redaction**: Sensitive authorization headers, cookies, API keys, and secret URL query parameters are redacted from logs.

---

## 9. Format Detection Classification

The detection engine classifies format certainty into three explicit statuses:
- **`verified`**: The file was conclusively verified by examining binary magic bytes (e.g., PNG `89 50 4E 47`, ZIP `50 4B 03 04`, PDF `%PDF-`).
- **`inferred`**: Binary magic bytes are generic, text-based, or inconclusive (e.g. `csv`, `txt`, `svg`, `docx`, `xlsx`), but HTTP `Content-Type` headers or filename extension reliably correspond to a known format.
- **`unknown`**: Neither binary headers, MIME type, nor filename extension could be matched.

---

## 10. Automated Testing & Verification

The project includes an end-to-end automated test suite utilizing **Vitest** and **Supertest** with a local mock HTTP server that simulates all test fixtures without depending on third-party websites.

### Run All Tests:
```bash
npm test
```

### Run Tests with Coverage Report:
```bash
npm run test:coverage
```

### Coverage Highlights:
- **Statements**: > 73%
- **Branches**: > 65%
- **Functions**: > 82%
- **Lines**: > 75%
- **Test Count**: 71 automated tests covering health, readiness, public discovery config, web frontend, same-origin dashboard proxy, platforms, SSRF, DNS rebinding, redirect loops, MIME mismatches, range requests, large files, streaming downloads, extract links, traversal archives, and API key authentication.

---

## 11. Docker & Production Deployment

Full deployment instructions are available in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

### Start with Docker Compose:
```bash
docker compose up -d --build
```

### Start with PM2 (Ubuntu Linux):
```bash
npm ci --omit=dev
pm2 start src/server.js --name "smmpro-downloader" -i max
```

---

## 12. Production Checklist

- [x] Configure a 32+ character random `API_KEY` in `.env`.
- [x] Set `API_KEY_REQUIRED=true` in production.
- [x] Configure explicit `CORS_ORIGINS` (e.g., `https://smmpro.pk`).
- [x] Terminate TLS/HTTPS via Nginx reverse proxy with valid certificates.
- [x] Set `TRUST_PROXY=true` when running behind Nginx, Cloudflare, or AWS ALB.
- [x] Monitor structured logs via Datadog, CloudWatch, or Grafana Loki.
- [x] Verify Docker container healthcheck reports `healthy`.

---

## 13. Support & Brand Attribution

**SMMpro**  
Website: [https://smmpro.pk/](https://smmpro.pk/)  
Product: SMMpro File Downloader API  
All rights reserved © 2026 SMMpro
