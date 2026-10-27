# SMMpro File Downloader API - Complete API Reference

Brand: **SMMpro**  
Website: [https://smmpro.pk/](https://smmpro.pk/)  
Product: **SMMpro File Downloader API**  
Version: `v1`  
Base URL: `/api/v1`

---

## 1. Authentication

When `API_KEY_REQUIRED=true` is enabled in configuration, all functional endpoints (detection, extraction, download, archive) require API key authentication via the `X-API-Key` HTTP header. System endpoints (`/health`, `/version`, `/platforms`, `/openapi.json`, `/docs`) do not require authentication.

```http
X-API-Key: YOUR_API_KEY
```

For browser GET download integration, `?apiKey=YOUR_API_KEY` or `?api_key=YOUR_API_KEY` is also accepted.

---

## 2. Standard Response Envelopes

### Success Envelope
All JSON endpoints wrap successful payloads in a consistent JSON envelope:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "requestId": "req_8fc671af3c874e93a7f73a006dc43acb"
}
```

### Error Envelope
When an error occurs, the API returns a consistent error envelope with machine-readable error codes:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "FORBIDDEN_DESTINATION",
    "message": "Access to private or prohibited network destinations is blocked.",
    "details": null
  },
  "requestId": "req_8fc671af3c874e93a7f73a006dc43acb"
}
```

### HTTP Status Codes & Error Codes

| HTTP Status | Error Code | Description |
|:---|:---|:---|
| **200** | `null` | Operation successful |
| **206** | `null` | Partial content returned (byte-range downloads) |
| **302** | `null` | Safe redirect to original upstream file |
| **400** | `VALIDATION_ERROR` | Malformed input, invalid URL, or redirect limit exceeded |
| **401** | `UNAUTHORIZED` | Missing or invalid API key |
| **403** | `FORBIDDEN_DESTINATION` | Blocked SSRF destination (loopback, private IP, cloud metadata) |
| **404** | `NOT_FOUND` | Unmatched route or endpoint |
| **413** | `PAYLOAD_TOO_LARGE` | File or request body exceeds maximum configured size |
| **415** | `UNSUPPORTED_FORMAT` | Format not supported (e.g. non-ZIP in archive inspection) |
| **422** | `UNPROCESSABLE_ENTITY` | Target URL returned an HTML page instead of a direct file |
| **429** | `TOO_MANY_REQUESTS` | Rate limit or maximum concurrent download limit exceeded |
| **502** | `UPSTREAM_ERROR` | Remote server returned an error or invalid response |
| **504** | `UPSTREAM_TIMEOUT` | Upstream connection or read timed out |
| **500** | `INTERNAL_SERVER_ERROR` | Unexpected internal server error |

---

## 3. Endpoints

### A. System Endpoints

#### 1. `GET /api/v1/health`
Returns service operational status, uptime, and brand info.

**curl (Linux/macOS Bash):**
```bash
curl -i http://localhost:3000/api/v1/health
```

**curl (Windows PowerShell):**
```powershell
curl.exe -i http://localhost:3000/api/v1/health
```

**curl (Windows CMD):**
```cmd
curl -i http://localhost:3000/api/v1/health
```

**Response Example:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-10-27T11:30:00.000Z",
    "uptimeSeconds": 360,
    "brand": "SMMpro",
    "service": "SMMpro File Downloader API"
  },
  "error": null,
  "requestId": "req_8a91f4..."
}
```

---

#### 2. `GET /api/v1/ready`
Readiness endpoint reporting whether the application process and its listeners are fully initialized and capable of accepting traffic. Used by container orchestrators (Kubernetes, Docker Swarm, Fly.io, Railway) and load balancers.

**curl:**
```bash
curl -i http://localhost:3000/api/v1/ready
```

**Response Example:**
```json
{
  "success": true,
  "data": {
    "status": "ready",
    "application": "SMMpro File Downloader",
    "timestamp": "2026-10-27T11:30:00.000Z",
    "uptimeSeconds": 360
  },
  "error": null,
  "requestId": "req_8a91f4..."
}
```

---

#### 3. `GET /api/v1/config/public`
Returns live public discovery configuration, base URLs for frontend integration, interactive Swagger documentation URL, and API key requirement status. Does **NOT** expose secret keys or internal infrastructure credentials.

**curl:**
```bash
curl -sS http://localhost:3000/api/v1/config/public
```

**Response Example:**
```json
{
  "success": true,
  "data": {
    "appName": "SMMpro File Downloader",
    "brand": "SMMpro",
    "website": "https://smmpro.pk/",
    "publicBaseUrl": "https://downloader.smmpro.pk",
    "apiBaseUrl": "https://downloader.smmpro.pk/api/v1",
    "docsUrl": "https://downloader.smmpro.pk/api/docs",
    "healthUrl": "https://downloader.smmpro.pk/api/v1/health",
    "testPageUrl": "https://downloader.smmpro.pk/test",
    "deploymentStatus": "live",
    "apiKeyRequired": true,
    "maxFileSizeBytes": 1073741824,
    "maxFileSizeHuman": "1 GB"
  },
  "error": null,
  "requestId": "req_8a91f4..."
}
```

---

#### 4. `GET /api/v1/version`
Returns API version, Node.js version, and environment.

**curl:**
```bash
curl -i http://localhost:3000/api/v1/version
```

---

#### 5. `GET /api/v1/platforms`
Returns supported file categories, detected formats, configured size limits, and feature flags.

**curl:**
```bash
curl -i http://localhost:3000/api/v1/platforms
```

---

### B. Public Web Pages & Testing Dashboard

#### 6. `GET /`
Polished modern SaaS homepage branded as **SMMpro File Downloader**. Features direct file inspection, live deployment status banner, supported formats grid, features showcase, and copyable integration curl commands.

#### 7. `GET /test`
Interactive Live Testing Dashboard. Allows users and developers to test URL detection, retrieve file metadata, inspect binary format verification, and trigger safe streaming file downloads through the actual backend API without exposing the server-side API key.

---

### C. File Detection & Metadata Endpoints

#### 4. `POST /api/v1/files/detect`
Detects file format and availability from direct file URL without downloading the full file.

**Request Body:**
```json
{
  "url": "https://example.com/files/archive.zip"
}
```

**curl (Linux/macOS Bash):**
```bash
curl -X POST "http://localhost:3000/api/v1/files/detect" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"url":"https://example.com/files/archive.zip"}'
```

**curl (Windows PowerShell):**
```powershell
curl.exe -X POST "http://localhost:3000/api/v1/files/detect" `
  -H "Content-Type: application/json" `
  -H "X-API-Key: YOUR_API_KEY" `
  -d '{\"url\":\"https://example.com/files/archive.zip\"}'
```

**curl (Windows CMD):**
```cmd
curl -X POST "http://localhost:3000/api/v1/files/detect" -H "Content-Type: application/json" -H "X-API-Key: YOUR_API_KEY" -d "{\"url\":\"https://example.com/files/archive.zip\"}"
```

**Response Example:**
```json
{
  "success": true,
  "data": {
    "filename": "archive.zip",
    "safeFilename": "archive.zip",
    "extension": "zip",
    "mimeType": "application/zip",
    "detectedMimeType": "application/zip",
    "sizeBytes": 26004684,
    "sizeHuman": "24.8 MB",
    "fileType": "archive",
    "formatStatus": "verified",
    "description": "ZIP Archive",
    "supportsRanges": true,
    "downloadAvailable": true
  },
  "error": null,
  "requestId": "req_df34a..."
}
```

---

#### 5. `POST /api/v1/files/info`
Returns structured metadata, safe filename suggestions, and authentication requirements.

**curl (Bash):**
```bash
curl -X POST "http://localhost:3000/api/v1/files/info" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"url":"https://example.com/files/archive.zip"}'
```

---

#### 6. `POST /api/v1/files/inspect`
Full technical inspection including HTTP status, redirect count, final resolved URL, and security warnings (such as executable detection, cross-domain redirects, or MIME/extension mismatches).

**curl (Bash):**
```bash
curl -X POST "http://localhost:3000/api/v1/files/inspect" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"url":"https://example.com/files/archive.zip"}'
```

**Response Example:**
```json
{
  "success": true,
  "data": {
    "filename": "archive.zip",
    "safeFilename": "archive.zip",
    "extension": "zip",
    "mimeType": "application/zip",
    "detectedMimeType": "application/zip",
    "sizeBytes": 26004684,
    "sizeHuman": "24.8 MB",
    "fileType": "archive",
    "formatStatus": "verified",
    "description": "ZIP Archive",
    "supportsRanges": true,
    "downloadAvailable": true,
    "requiresAuth": false,
    "httpStatus": 200,
    "finalUrl": "https://example.com/files/archive.zip",
    "redirectCount": 0,
    "securityWarnings": [],
    "detectedAt": "2026-10-27T11:30:15.123Z"
  },
  "error": null,
  "requestId": "req_81f2..."
}
```

---

### C. Webpage Downloadable-Link Extractor

#### 7. `POST /api/v1/extract-links`
Discovers candidate downloadable links inside webpage HTML. Resolves relative URLs, deduplicates, and filters prohibited internal IPs.

**Request Body:**
```json
{
  "url": "https://example.com/downloads",
  "limit": 20
}
```

**curl (Bash):**
```bash
curl -X POST "http://localhost:3000/api/v1/extract-links" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"url":"https://example.com/downloads","limit":20}'
```

**Response Example:**
```json
{
  "success": true,
  "data": {
    "pageUrl": "https://example.com/downloads",
    "totalCandidates": 3,
    "returnedCount": 3,
    "links": [
      {
        "url": "https://example.com/files/release-v1.zip",
        "label": "Download Release v1.0",
        "extension": "zip",
        "category": "archive",
        "inferredFormat": "ZIP Archive",
        "hasDownloadAttribute": true
      },
      {
        "url": "https://example.com/docs/manual.pdf",
        "label": "User Documentation",
        "extension": "pdf",
        "category": "document",
        "inferredFormat": "Portable Document Format",
        "hasDownloadAttribute": false
      }
    ]
  },
  "error": null,
  "requestId": "req_e901..."
}
```

---

### D. Secure File Downloading

#### 8. `POST /api/v1/download`
Downloads the file via high-performance streaming proxy (default) or redirect mode.

**Streaming Mode (default):**
```bash
curl -fL -X POST "http://localhost:3000/api/v1/download" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"url":"https://example.com/files/archive.zip","mode":"stream"}' \
  -o archive.zip
```

**Download with Real-time Progress Bar:**
```bash
curl -# -fL -X POST "http://localhost:3000/api/v1/download" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"url":"https://example.com/files/archive.zip","mode":"stream"}' \
  -o archive.zip
```

**Redirect Mode:**
```bash
curl -i -X POST "http://localhost:3000/api/v1/download" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"url":"https://example.com/files/archive.zip","mode":"redirect"}'
```

#### 9. `GET /api/v1/download`
For direct browser integration and simple hyperlinks.

```bash
curl -fL "http://localhost:3000/api/v1/download?url=https%3A%2F%2Fexample.com%2Ffiles%2Farchive.zip&mode=stream" \
  -H "X-API-Key: YOUR_API_KEY" \
  -o archive.zip
```

---

### E. Archive Inspection

#### 10. `POST /api/v1/archive/inspect`
Inspects entries in a ZIP archive without extracting them. Protects against ZIP bombs and flags directory traversal attacks (`../`).

**curl (Bash):**
```bash
curl -X POST "http://localhost:3000/api/v1/archive/inspect" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"url":"https://example.com/files/archive.zip"}'
```

**Response Example:**
```json
{
  "success": true,
  "data": {
    "archiveUrl": "https://example.com/files/archive.zip",
    "format": "zip",
    "totalEntries": 4,
    "totalCompressedBytes": 102400,
    "totalCompressedHuman": "100.0 KB",
    "totalUncompressedBytes": 450000,
    "totalUncompressedHuman": "439.4 KB",
    "compressionRatio": "4.4:1",
    "hasSuspiciousEntries": false,
    "securityWarnings": [],
    "entries": [
      {
        "fileName": "docs/readme.txt",
        "uncompressedSize": 1250,
        "compressedSize": 530,
        "compressionMethod": 8,
        "isDirectory": false,
        "lastModified": "2026-10-25T14:30:00.000Z",
        "isSuspicious": false
      }
    ]
  },
  "error": null,
  "requestId": "req_c34..."
}
```

---

### F. Interactive Documentation

- **Swagger UI**: [`http://localhost:3000/api/docs`](http://localhost:3000/api/docs)
- **OpenAPI 3.0 JSON**: [`http://localhost:3000/api/v1/openapi.json`](http://localhost:3000/api/v1/openapi.json)
