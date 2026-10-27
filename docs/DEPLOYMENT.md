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

## 2. Docker & Docker Compose Deployment (Recommended)

### A. Prerequisites
Ensure Docker and Docker Compose plugin are installed:
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### B. Configuration
1. Clone the repository and navigate to the project directory:
   ```bash
   git clone https://github.com/smmpro/smmpro-file-downloader-api.git /opt/smmpro-file-downloader
   cd /opt/smmpro-file-downloader
   ```

2. Create the production `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```

3. Generate a cryptographically secure 32+ character API key:
   ```bash
   openssl rand -hex 32
   ```

4. Edit `.env` with production values:
   ```ini
   NODE_ENV=production
   PORT=3000
   HOST=0.0.0.0
   API_KEY_REQUIRED=true
   API_KEY=your_generated_64_character_hex_secret_here
   CORS_ORIGINS=https://smmpro.pk
   TRUST_PROXY=true
   REQUEST_TIMEOUT_MS=10000
   EXTRACT_TIMEOUT_MS=15000
   MAX_REDIRECTS=5
   MAX_EXTRACTED_LINKS=50
   MAX_FILE_SIZE_BYTES=1073741824
   MAX_CONCURRENT_DOWNLOADS=5
   DETECTION_RATE_LIMIT=30
   DOWNLOAD_RATE_LIMIT=10
   LOG_LEVEL=info
   ENABLE_ARCHIVE_INSPECTION=false
   ```

### C. Build and Start Container
```bash
docker compose up -d --build
```

### D. Verify Deployment
```bash
# Check container status
docker compose ps

# Check container healthcheck status
docker inspect --format='{{json .State.Health}}' smmpro-file-downloader

# Test health endpoint
curl -i http://localhost:3000/api/v1/health

# View structured logs
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

## 4. Nginx Reverse Proxy & SSL Termination

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
