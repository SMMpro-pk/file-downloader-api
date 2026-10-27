# SMMpro File Downloader API - Production Deployment Guide

Brand: **SMMpro**  
Website: [https://smmpro.pk/](https://smmpro.pk/)  
Product: **SMMpro File Downloader API**

---

## 1. System Requirements

- **Operating System**: Ubuntu 22.04 LTS or 24.04 LTS (or any Linux distribution running Docker)
- **Node.js**: Node.js 22 LTS or Node.js 20 LTS
- **Memory**: Minimum 512 MB RAM (1 GB recommended for high concurrent stream transfers)
- **CPU**: 1+ cores
- **Storage**: 2 GB free disk space (API does not buffer downloads to disk)

---

## 2. Docker & Docker Compose Deployment (Zero-Manual-Configuration)

The SMMpro File Downloader API is built for **Docker-first, zero-manual-configuration** deployment. You can launch the container directly using `docker compose up -d` or `docker run` without manually creating or configuring a `.env` file.

### A. Instant Zero-Configuration Startup
```bash
# 1. Clone the repository
git clone https://github.com/smmpro/smmpro-file-downloader-api.git /opt/smmpro-file-downloader
cd /opt/smmpro-file-downloader

# 2. Start container directly (NO .env file required!)
docker compose up -d --build
```
The application will automatically:
- Start with safe, production-ready defaults.
- Bind to `0.0.0.0:${PORT:-3000}`.
- Auto-initialize `data/` and `tmp/` runtime directories with secure `0o750` permissions.
- Provide full access to the Homepage (`/`), Live Testing Dashboard (`/test`), OpenAPI spec (`/api/openapi.json`), Swagger UI (`/api/docs`), and Health endpoints (`/api/v1/health`, `/api/v1/ready`).

### B. Feature Configuration Matrix: Zero-Config vs Optional Host Settings

| Feature / Setting | Zero Configuration (Default) | Optional Host Setting Override | Purpose / Behavior |
|:---|:---|:---|:---|
| **Port Binding** | `PORT=3000` on `0.0.0.0` | `PORT=<host-assigned-port>` | Respects hosting platform's runtime port dynamically |
| **Authentication** | `API_KEY_REQUIRED=false` (Public API) | `API_KEY_REQUIRED=true`<br>`API_KEY=<secret>` | When enabled without `API_KEY`, a stable 32-byte key is automatically generated and saved to `data/.api-key` (mode `0o600`) |
| **Public URL Discovery** | Auto-detected for Render, Railway, Fly.io, Vercel, Heroku, Koyeb | `PUBLIC_BASE_URL=https://your-domain.com` | Override for custom VPS, domains, or reverse proxies without recognized cloud hostname envs |
| **CORS Policy** | `CORS_ORIGINS=*` (Universal access) | `CORS_ORIGINS=https://smmpro.pk,https://app.smmpro.pk` | Restricts API access to specific approved origins |
| **Directory Initialization** | `data/` & `tmp/` auto-created | Mounted Docker volumes (`smmpro-data`, `smmpro-tmp`) | Preserves runtime data and cached keys without user intervention |
| **Temporary Files** | In-flight streaming (zero permanent disk footprint) | N/A | High throughput, backpressure-controlled streaming |
| **SSRF & Private IP Shield** | Fully Active | Cannot be bypassed in production | Blocks loopback, RFC 1918 private subnets, cloud metadata (169.254.169.254) |
| **Interactive Test Dashboard** | Live at `/test` | Same-origin backend proxy (`/api/internal/*`) | Allows live testing of file inspection, metadata, webpage link extraction, and download stream |
| **Archive Inspection** | `ENABLE_ARCHIVE_INSPECTION=false` | `ENABLE_ARCHIVE_INSPECTION=true` | Enables in-memory ZIP Central Directory inspection |

### C. Persistent Storage & Stable API Keys
When deployed with `docker-compose.yml`, persistent storage is managed via the `smmpro-data` named volume:
- If `API_KEY_REQUIRED=true` and no `API_KEY` is provided in environment variables, the server generates a stable 32-byte cryptographic key and stores it in `/usr/src/app/data/.api-key`.
- **Container Restarts:** The server checks `data/.api-key` on startup and reuses the existing key, ensuring API keys do not rotate arbitrarily on container restarts.

#### How to Inspect or Rotate the Stable Key:
```bash
# Retrieve the generated stable API key:
docker exec smmpro-file-downloader cat /usr/src/app/data/.api-key

# To rotate the key:
# Option 1: Provide a new key via environment variable:
#   API_KEY=my_new_secret_key_at_least_32_characters docker compose up -d
# Option 2: Remove the persisted key file and restart:
docker exec smmpro-file-downloader rm -f /usr/src/app/data/.api-key
docker compose restart
```

### D. Single Container Docker Run (Without Compose)
```bash
docker build -t smmpro-file-downloader .
docker run -d \
  --name smmpro-file-downloader \
  -p 3000:3000 \
  -v smmpro-data:/usr/src/app/data \
  smmpro-file-downloader
```

### E. Verify Container Deployment
```bash
# Check container status & healthcheck
docker compose ps

# Test health check endpoint
curl -i http://localhost:3000/api/v1/health

# Test public configuration endpoint
curl -i http://localhost:3000/api/v1/config/public

# View real-time JSON logs
docker compose logs -f api
```

---

## 3. Ubuntu Native Deployment (PM2)

If containerization is not desired, deploy directly using Node.js 22 LTS and PM2 process manager:

### A. Install Node.js 22 LTS & PM2
```bash
# Install NodeSource Node.js 22 LTS repository
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential

# Verify versions
node -v   # v22.x.x
npm -v    # v10.x.x or higher

# Install PM2 globally
sudo npm install -g pm2
```

### B. Create Dedicated Service User
```bash
sudo useradd -r -s /bin/false -d /opt/smmpro-file-downloader smmpro
sudo mkdir -p /opt/smmpro-file-downloader
sudo chown -R smmpro:smmpro /opt/smmpro-file-downloader
```

### C. Deploy Application
```bash
cd /opt/smmpro-file-downloader
# Copy source files
sudo -u smmpro git clone https://github.com/smmpro/smmpro-file-downloader-api.git .
sudo -u smmpro cp .env.example .env
# Edit .env with your secrets
sudo -u smmpro nano .env

# Install production dependencies
sudo -u smmpro npm ci --omit=dev
```

### D. Configure PM2 Ecosystem
Create `ecosystem.config.cjs`:
```javascript
module.exports = {
  apps: [
    {
      name: 'smmpro-downloader',
      script: 'src/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      kill_timeout: 15000,
      wait_ready: true,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

Start the application:
```bash
sudo -u smmpro pm2 start ecosystem.config.cjs
sudo pm2 startup systemd -u smmpro --hp /opt/smmpro-file-downloader
sudo -u smmpro pm2 save
```

---

## 4. One-Click GitHub-Integrated Cloud Deployments

The repository includes pre-configured infrastructure descriptors for one-click deployment across major cloud providers directly connected to your GitHub repository.

### Option A: Render.com (Blueprints)
1. Fork or push `SMMpro-pk/file-downloader-api` to your GitHub account.
2. In the [Render Dashboard](https://dashboard.render.com/), click **New +** -> **Blueprint**.
3. Connect your repository. Render reads [`render.yaml`](../render.yaml) automatically.
4. Set or confirm the environment variables:
   - `PUBLIC_BASE_URL`: (Optional) Render automatically exposes `RENDER_EXTERNAL_URL` which the application auto-discovers!
   - `API_KEY`: Click "Generate" or provide your secret 32+ character key.
   - `CORS_ORIGINS`: Add your frontend domain(s) (e.g. `https://smmpro.pk`).
5. Click **Apply**.
6. The app builds via Docker / Node, binds to `0.0.0.0:${PORT}`, and executes `/api/v1/health` for verification.

### Option B: Railway.app
1. Navigate to [Railway](https://railway.app/) and click **New Project** -> **Deploy from GitHub repo**.
2. Select your repository. Railway detects the [`Dockerfile`](../Dockerfile) and [`railway.json`](../railway.json).
3. In **Variables**, add:
   - `NODE_ENV=production`
   - `API_KEY_REQUIRED=true`
   - `API_KEY=your_secure_random_key_here`
   - `CORS_ORIGINS=https://smmpro.pk`
4. Under **Settings** -> **Networking**, click **Generate Domain**. Railway automatically provides `RAILWAY_PUBLIC_DOMAIN` which the app auto-discovers!
5. Deployment will automatically initiate and verify readiness on `/api/v1/health`.

### Option C: Fly.io
1. Install flyctl: `curl -L https://fly.io/install.sh | sh`
2. Launch the app using the included [`fly.toml`](../fly.toml):
   ```bash
   fly launch --copy-config
   ```
3. Set production secrets securely:
   ```bash
   fly secrets set API_KEY="your_secure_32_character_hex_secret" API_KEY_REQUIRED="true"
   ```
4. Deploy the machine:
   ```bash
   fly deploy
   ```
5. Fly automatically provides `FLY_APP_NAME`, which the URL discovery service uses to derive `https://${FLY_APP_NAME}.fly.dev`.

---

## 5. Automatic Live URL Discovery & Public Base URL Configuration

The application features an automatic URL-discovery engine (`src/services/url-discovery.service.js`):

1. **Explicit Configuration (`PUBLIC_BASE_URL`)**:
   If set (e.g. `PUBLIC_BASE_URL=https://api.yourdomain.com`), this URL is always prioritized.
2. **Provider Documented Hostnames**:
   If `PUBLIC_BASE_URL` is omitted, the engine inspects documented platform runtime variables:
   - **Render**: `RENDER_EXTERNAL_URL`
   - **Railway**: `RAILWAY_PUBLIC_DOMAIN` or `RAILWAY_STATIC_URL`
   - **Fly.io**: `FLY_APP_NAME` (`https://${FLY_APP_NAME}.fly.dev`)
   - **Vercel**: `VERCEL_URL`
   - **Heroku**: `HEROKU_APP_NAME` (`https://${HEROKU_APP_NAME}.herokuapp.com`)
   - **Koyeb**: `KOYEB_PUBLIC_DOMAIN`
   - **Local Development**: `LOCAL_BASE_URL` or `http://localhost:${PORT}`
3. **Untrusted Header Prevention**:
   The engine **never** derives the public base URL from untrusted client-supplied `Host`, `X-Forwarded-Host`, or `Referer` headers, preventing host-header injection and cache poisoning attacks.
4. **Configuration Alerting**:
   If deployed in production without an explicit or provider-supplied public URL, the deployment status enters `configuration_required`, and `/api/v1/config/public` explicitly instructs the administrator on how to configure `PUBLIC_BASE_URL`.

---

## 6. Deployment Verification Procedure

Never mark or report a deployment as live until verified through this sequence:

1. **Process & Socket Verification**:
   ```bash
   curl -i http://localhost:3000/api/v1/health
   # Must return HTTP 200 with {"status":"healthy"}
   ```

2. **Readiness Verification**:
   ```bash
   curl -i http://localhost:3000/api/v1/ready
   # Must return HTTP 200 with {"status":"ready"}
   ```

3. **Public URL Discovery Verification**:
   ```bash
   curl -sS http://localhost:3000/api/v1/config/public
   # Check "publicBaseUrl" and "deploymentStatus"
   ```

4. **Web Frontend & Dashboard Verification**:
   Open in your browser:
   - Root homepage: `https://YOUR_DOMAIN/`
   - Testing dashboard: `https://YOUR_DOMAIN/test`
   - Swagger documentation: `https://YOUR_DOMAIN/api/docs`

5. **Functional Detection & Streaming Download Test**:
   ```bash
   # Test file detection
   curl -sS -X POST "https://YOUR_DOMAIN/api/v1/files/info" \
     -H "Content-Type: application/json" \
     -H "X-API-Key: YOUR_API_KEY" \
     -d '{"url":"https://raw.githubusercontent.com/file-fixtures/test.zip"}'

   # Test safe download streaming
   curl -fL -X POST "https://YOUR_DOMAIN/api/v1/download" \
     -H "Content-Type: application/json" \
     -H "X-API-Key: YOUR_API_KEY" \
     -d '{"url":"https://raw.githubusercontent.com/file-fixtures/test.zip","mode":"stream"}' \
     -o test_download.zip
   ```

---

## 7. API Key Rotation

To rotate API keys without downtime:
1. Update `API_KEY` in your environment (e.g. Render Dashboard or `.env`).
2. Reload or restart the application:
   - On Render/Railway/Fly.io: The platform executes a rolling update.
   - On Docker Compose: `docker compose up -d --no-deps api`
   - On PM2: `pm2 reload smmpro-downloader`
3. Update frontend client configurations to the new key.
4. Verify using:
   ```bash
   curl -i https://YOUR_DOMAIN/api/v1/health -H "X-API-Key: NEW_KEY"
   ```

---

## 8. Nginx Reverse Proxy & SSL Termination

Expose the API publicly through Nginx with HTTPS, rate limiting, and HTTP/2.

### A. Install Nginx & Certbot
```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

### B. Nginx Site Configuration
Create `/etc/nginx/sites-available/smmpro-downloader.conf`:

```nginx
# Rate limiting zone (10 requests per second per IP)
limit_req_zone $binary_remote_addr zone=smmpro_api_limit:10m rate=10r/s;
limit_conn_zone $binary_remote_addr zone=smmpro_conn_limit:10m;

server {
    listen 80;
    listen [::]:80;
    server_name api.smmpro.pk;

    # Redirect all HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.smmpro.pk;

    # SSL Certificates (managed by Let's Encrypt Certbot)
    ssl_certificate /etc/letsencrypt/live/api.smmpro.pk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.smmpro.pk/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Security Headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Request Body Limit (32 KB for JSON API payloads)
    client_max_body_size 64k;

    # Proxy buffer settings for streaming
    proxy_buffering off;
    proxy_request_buffering off;
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;

    location / {
        limit_req zone=smmpro_api_limit burst=20 nodelay;
        limit_conn smmpro_conn_limit 10;

        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site and test configuration:
```bash
sudo ln -s /etc/nginx/sites-available/smmpro-downloader.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Obtain SSL certificate with Certbot:
```bash
sudo certbot --nginx -d api.smmpro.pk
```

---

## 5. Graceful Shutdown & Zero-Downtime Upgrades

When updating or restarting the service:
1. SMMpro listens for `SIGTERM` and `SIGINT` signals.
2. The HTTP server immediately ceases accepting new connections.
3. Active download streams are allowed up to **15 seconds** to drain.
4. If running under PM2 cluster mode or Docker Swarm / Kubernetes rolling update, traffic routes to sibling instances with **zero dropped requests**.

To perform a zero-downtime rolling reload with PM2:
```bash
pm2 reload smmpro-downloader
```

With Docker Compose:
```bash
docker compose pull && docker compose up -d --no-deps api
```
