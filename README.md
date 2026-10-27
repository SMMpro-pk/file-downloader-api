# SMMpro File Downloader API

<div align="center">

![SMMpro Brand](https://smmpro.pk/favicon.ico)

**Enterprise-Grade File Detection, Metadata Inspection, Link Discovery, and Secure Streaming Proxy**

[![Node.js Version](https://img.shields.io/badge/Node.js-22%20LTS-339933?logo=node.js)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-4.21-000000?logo=express)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red)](#)
[![Tests](https://img.shields.io/badge/Tests-53%20Passing-brightgreen?logo=vitest)](https://vitest.dev/)
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

- **Direct URL File Detection**: Inspects remote URLs without downloading entire files. Employs bounded Range requests (initial 16 KB) and HEAD fallback to read binary signatures.
- **Binary Format Verification (`file-type`)**: Detects actual file format from binary headers, avoiding deceptive or spoofed file extensions.
- **Comprehensive File Type Registry**: Supports archives (ZIP, RAR, 7Z, TAR, GZ, BZ2, XZ), documents (PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, EPUB), images (JPG, PNG, WEBP, GIF, SVG, TIFF, BMP, AVIF), audio (MP3, WAV, FLAC, AAC, M4A, OGG, OPUS), video (MP4, WEBM, MOV, MKV, AVI, MPEG), and software packages (APK, EXE, MSI, DMG, ISO, DEB, RPM).
- **Webpage Downloadable-Link Extractor**: Parses server-rendered HTML using `cheerio`, discovers candidate files from `<a>`, `<area>`, and `[download]` attributes, resolves relative URLs, and filters out private/prohibited hosts.
- **Secure Streaming Proxy**: Streams files directly using Node.js backpressure pipelines with sanitized `Content-Disposition: attachment`, real-time size limit enforcement, Range forwarding, and client disconnect abort propagation.
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

## 4. Quickstart Guide

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

## 5. Configuration (`.env`)

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

## 6. Complete curl API Testing Guide

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

## 7. Security Architecture

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

## 8. Format Detection Classification

The detection engine classifies format certainty into three explicit statuses:
- **`verified`**: The file was conclusively verified by examining binary magic bytes (e.g., PNG `89 50 4E 47`, ZIP `50 4B 03 04`, PDF `%PDF-`).
- **`inferred`**: Binary magic bytes are generic, text-based, or inconclusive (e.g. `csv`, `txt`, `svg`, `docx`, `xlsx`), but HTTP `Content-Type` headers or filename extension reliably correspond to a known format.
- **`unknown`**: Neither binary headers, MIME type, nor filename extension could be matched.

---

## 9. Automated Testing & Verification

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
- **Statements**: > 74%
- **Branches**: > 65%
- **Functions**: > 80%
- **Lines**: > 75%
- **Test Count**: 53 automated tests covering health, version, platforms, SSRF, DNS rebinding, redirect loops, MIME mismatches, range requests, large files, streaming downloads, extract links, traversal archives, and API key authentication.

---

## 10. Docker & Production Deployment

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

## 11. Production Checklist

- [x] Configure a 32+ character random `API_KEY` in `.env`.
- [x] Set `API_KEY_REQUIRED=true` in production.
- [x] Configure explicit `CORS_ORIGINS` (e.g., `https://smmpro.pk`).
- [x] Terminate TLS/HTTPS via Nginx reverse proxy with valid certificates.
- [x] Set `TRUST_PROXY=true` when running behind Nginx, Cloudflare, or AWS ALB.
- [x] Monitor structured logs via Datadog, CloudWatch, or Grafana Loki.
- [x] Verify Docker container healthcheck reports `healthy`.

---

## 12. Support & Brand Attribution

**SMMpro**  
Website: [https://smmpro.pk/](https://smmpro.pk/)  
Product: SMMpro File Downloader API  
All rights reserved © 2026 SMMpro
