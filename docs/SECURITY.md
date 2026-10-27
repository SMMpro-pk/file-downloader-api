# SMMpro File Downloader API - Security Specification & Threat Model

Brand: **SMMpro**  
Website: [https://smmpro.pk/](https://smmpro.pk/)  
Product: **SMMpro File Downloader**  
Last Updated: October 2026

---

## 1. Overview & Threat Model

The **SMMpro File Downloader API** processes arbitrary user-supplied URLs to inspect remote metadata, verify file signatures, discover download links, and proxy downloads. Because the backend initiates outbound HTTP connections to external infrastructure, it operates under a strict **Zero-Trust Input Model**.

### Core Attack Vectors Mitigated:
1. **Server-Side Request Forgery (SSRF)**: Accessing local host services, internal microservices, private cloud subnets, or virtualization metadata services.
2. **DNS Rebinding & TOCTOU (Time-Of-Check to Time-Of-Use)**: Resolving a public IP during pre-check and switching to `127.0.0.1` upon socket connection.
3. **Redirect Hop Exploitation**: Bypassing URL checks by redirecting from an allowed public host to internal cloud metadata (`169.254.169.254`).
4. **Denial of Service (DoS) & Resource Exhaustion**: Infinite redirects, multi-gigabyte responses, ZIP bombs, and concurrent download pool starvation.
5. **Path Traversal & Header Injection**: Null bytes, `../` sequences in Content-Disposition or archive filenames, carriage return / line feed (`\r\n`) header injections, and Windows reserved device names (`CON`, `AUX`, `NUL`).
6. **Information Leakage**: Sensitive query strings (tokens, API keys, signatures) in logs, stack traces in error envelopes, or internal IP disclosures.

---

## 2. Server-Side Request Forgery (SSRF) Defense

### A. URL Scheme & Syntax Sanitization
- Only `http:` and `https:` schemes are permitted.
- Non-standard protocols (`ftp:`, `file:`, `gopher:`, `dict:`, `ldap:`) are blocked at parse time.
- Embedded user credentials (`http://user:pass@host`) are strictly rejected.
- URL character length is capped at 2,048 characters.

### B. Prohibited IP Ranges
Every resolved IP address is validated against an exhaustive CIDR blocklist utilizing `ipaddr.js`:

#### IPv4 Prohibited Ranges:
| Range | CIDR | Purpose / Attack Prevented |
|:---|:---|:---|
| Unspecified | `0.0.0.0/8` | Broadcast / current network |
| Loopback | `127.0.0.0/8` | Localhost services (`127.0.0.1` - `127.255.255.254`) |
| Link-Local | `169.254.0.0/16` | Cloud metadata endpoints (e.g. AWS/Azure `169.254.169.254`) |
| RFC 1918 Private | `10.0.0.0/8` | Internal corporate/VPC subnets |
| RFC 1918 Private | `172.16.0.0/12` | Docker bridges, Kubernetes pods, internal subnets |
| RFC 1918 Private | `192.168.0.0/16` | Local router gateways and LAN services |
| Carrier-Grade NAT | `100.64.0.0/10` | CGNAT, Tailscale, Cloud VPC interconnects (e.g. `100.100.100.200`) |
| Documentation | `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24` | RFC 5737 test nets |
| Benchmarking | `198.18.0.0/15` | Inter-network benchmarking |
| Multicast | `224.0.0.0/4` | Multicast groups |
| Reserved | `240.0.0.0/4` | Future use / non-routable |
| Broadcast | `255.255.255.255/32` | Local broadcast |

#### IPv6 Prohibited Ranges:
- `::/128`: Unspecified
- `::1/128`: Loopback
- `fe80::/10`: Link-local unicast
- `fc00::/7`: Unique local unicast (ULA)
- `ff00::/8`: Multicast
- `::ffff:0:0/96`: IPv4-mapped IPv6. **Critical**: Unmapped and validated against IPv4 rules to prevent bypasses such as `::ffff:127.0.0.1` or `::ffff:169.254.169.254`.

### C. Hostname Suffix Blacklist
Hostnames ending in `.local`, `.internal`, `.onion`, `.lan`, `.home`, `.corp`, and `.localdomain`, as well as `metadata.google.internal` and `instance-data`, are rejected before DNS lookup.

---

## 3. DNS Rebinding Prevention & Socket Pinning

A simple hostname pre-check is vulnerable to DNS Rebinding: an attacker creates a domain with a low TTL (1 second) that returns a public IP during pre-check, and immediately switches to `127.0.0.1` when the HTTP socket opens.

### The Solution: Custom Socket Lookup Pinning
The SMMpro outbound HTTP client (`SafeHttpService`) passes a custom `lookup` function directly to Node's `http.request` / `https.request` options:
1. `dns.lookup` executes immediately before socket creation (`net.connect`).
2. All resolved IP addresses are validated against the prohibited CIDR list.
3. The socket connects directly to the validated IP.
4. For HTTPS, `options.servername` is explicitly set to the original hostname, guaranteeing TLS SNI certificate verification remains intact while the physical socket is pinned.
5. This completely eliminates the TOCTOU window between validation and TCP handshake.

---

## 4. Redirect Hop Validation

- Remote servers frequently issue `301`, `302`, `303`, `307`, or `308` redirects.
- Standard HTTP clients blindly follow redirects, allowing attackers to bounce from a public URL to `http://169.254.169.254/latest/meta-data/`.
- SMMpro intercepts every redirect header manually.
- The destination `Location` is parsed, checked for valid scheme (`http`/`https`), and fully re-validated through the DNS & IP filter before any connection is made.
- Redirect hops are strictly limited to `MAX_REDIRECTS` (default 5). Circular redirect loops are detected and rejected.

---

## 5. Filename Sanitization & Directory Traversal Defenses

Remote files often supply malicious filenames via `Content-Disposition: attachment; filename="../../etc/shadow"` or URL paths containing Windows device names.

The `sanitizeFilename` utility enforces:
1. **Directory Traversal**: Strips all leading `../`, `..\`, and slashes via `path.basename()`.
2. **Control Characters & Null Bytes**: Strips ASCII 0–31, 127, and null bytes (`\0`).
3. **Illegal Filesystem Characters**: Replaces `< > : " / \ | ? *` with safe underscores (`_`).
4. **Windows Reserved Device Names**: If base name matches `CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, or `LPT1-9`, prefixes with `safe_` (e.g. `safe_CON.txt`, `safe_aux.pdf`).
5. **Length Bounds**: Enforces 255-character maximum length while preserving the verified extension.
6. **Fallback Safe Naming**: If sanitized output is empty or whitespace, defaults to `download.bin` or `download.<ext>`.

---

## 6. Archive Inspection & ZIP Bomb Defense

The archive inspection service (`ArchiveService`) utilizes `yauzl` with random-access Central Directory parsing without extracting files to the filesystem:
- **Maximum Inspectable Archive Size**: 50 MB (`MAX_ARCHIVE_INSPECT_BUFFER_BYTES`).
- **Maximum Archive Entries**: 1,000 entries (`MAX_ARCHIVE_ENTRIES`).
- **Maximum Uncompressed Size Threshold**: 250 MB (`MAX_ARCHIVE_UNCOMPRESSED_TOTAL_BYTES`).
- **Compression Ratio Alert**: Flags archives with compression ratios exceeding 100:1 as suspected ZIP bombs.
- **Entry Traversal Detection**: Detects entries containing `..`, absolute paths (`/` or `C:\`), or null bytes and flags them as `hasSuspiciousEntries: true`.
- **Feature Flag**: Disabled by default in production (`ENABLE_ARCHIVE_INSPECTION=false`).

---

## 7. Stream Proxying & Resource Protection

- **Memory Safety**: Files are never buffered into heap memory during downloads. Responses are streamed directly using Node.js backpressure pipelines (`stream.pipeline`).
- **Size Enforcement**: If upstream advertises `Content-Length > MAX_FILE_SIZE_BYTES` (default 1 GB), the request is rejected with `413 Payload Too Large`. If the server omits `Content-Length` or lies, a real-time `SizeEnforcementStream` counts bytes and forcibly destroys the stream if the limit is exceeded.
- **Client Disconnect Propagation**: When a client closes the browser tab or disconnects, `req.on('close')` fires `abortController.abort()` to destroy the upstream connection immediately and reclaim backend resources.
- **Concurrency Limiting**: Active downloads per Node process are limited by a concurrency semaphore (`MAX_CONCURRENT_DOWNLOADS=5`).
- **Timeouts**: Socket inactive timeout (60s), overall request timeout (10s), extraction timeout (15s).

---

## 8. Authentication & Logging Redaction

- **Timing-Safe HMAC Authentication**: When `API_KEY_REQUIRED=true`, API keys are evaluated using `crypto.timingSafeEqual` with an ephemeral HMAC key, eliminating timing attacks on secret length.
- **Log Privacy & Redaction**: Structured Pino logs redact `X-API-Key`, `Authorization`, `Cookie`, `Set-Cookie`, and sanitize sensitive URL query parameters (`token`, `key`, `secret`, `signature`, `password`).
- **Production Error Masking**: In production (`NODE_ENV=production`), internal stack traces, system paths, and internal IPs are masked with generic, actionable error messages.
