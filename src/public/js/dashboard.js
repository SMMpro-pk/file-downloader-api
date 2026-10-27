/**
 * SMMpro File Downloader - Dashboard & Testing Client
 */

// Global State
let currentPublicConfig = null;
let currentFileInfo = null;
let downloadAbortController = null;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  loadPublicConfig();
  setupEventListeners();
  setupSampleButtons();
});

/**
 * Loads runtime configuration and live URLs from the public config endpoint.
 */
async function loadPublicConfig() {
  try {
    const res = await fetch('/api/v1/config/public');
    const envelope = await res.json();
    if (envelope.success && envelope.data) {
      currentPublicConfig = envelope.data;
      updateDashboardUI(currentPublicConfig);
    }
  } catch (err) {
    console.warn('Could not load public config:', err);
    updateStatusPill('unavailable', 'API Offline');
  }
}

/**
 * Updates UI elements with actual live deployment URLs and statuses.
 */
function updateDashboardUI(config) {
  const { deploymentStatus, publicBaseUrl, apiBaseUrl, docsUrl, healthUrl, testPageUrl, apiKeyRequired, configurationHelp } = config;

  // 1. Update Status Pill
  if (deploymentStatus === 'live') {
    updateStatusPill('live', 'Live & Operational');
  } else if (deploymentStatus === 'local_development') {
    updateStatusPill('live', 'Local Development');
  } else {
    updateStatusPill('waiting', 'Configuration Required');
  }

  // 2. Update Live URLs
  const displayPublic = publicBaseUrl || 'Awaiting configuration (set PUBLIC_BASE_URL)';
  setTextContent('display-app-name', config.appName || 'SMMpro File Downloader');
  setTextContent('display-public-url', displayPublic);
  setTextContent('display-api-url', apiBaseUrl || '/api/v1');
  setTextContent('display-health-url', healthUrl || '/api/v1/health');
  setTextContent('display-docs-url', docsUrl || '/api/docs');
  setTextContent('display-test-url', testPageUrl || '/test');
  setTextContent('display-auth-status', apiKeyRequired ? 'API Key Required (X-API-Key)' : 'Public (No key required)');

  // 3. Update Link Hrefs
  setHref('link-docs', docsUrl || '/api/docs');
  setHref('link-health', healthUrl || '/api/v1/health');
  setHref('link-test', testPageUrl || '/test');

  // 4. Update curl code snippets dynamically with resolved API URL
  const base = publicBaseUrl ? apiBaseUrl : 'https://YOUR_DEPLOYED_DOMAIN/api/v1';
  const curlDetect = `curl -X POST "${base}/files/detect" \\\n  -H "Content-Type: application/json" \\\n  -d '{"url":"https://example.com/file.zip"}'`;
  setTextContent('curl-detect-snippet', curlDetect);

  const curlDownload = `curl -fL -X POST "${base}/download" \\\n  -H "Content-Type: application/json" \\\n  -d '{"url":"https://example.com/file.zip","mode":"stream"}' \\\n  -o downloaded_file.zip`;
  setTextContent('curl-download-snippet', curlDownload);

  // 5. Configuration Help Warning Box
  const helpBoxes = document.querySelectorAll('.config-help-box');
  helpBoxes.forEach((box) => {
    if (deploymentStatus === 'configuration_required' && configurationHelp) {
      box.style.display = 'block';
      const textEl = box.querySelector('.config-help-text') || box;
      textEl.textContent = configurationHelp;
    } else {
      box.style.display = 'none';
    }
  });
}

function updateStatusPill(status, text) {
  const pills = document.querySelectorAll('.status-pill');
  pills.forEach((p) => {
    p.className = `status-pill ${status === 'live' ? 'status-live' : 'status-waiting'}`;
    const textEl = p.querySelector('.status-text') || p;
    textEl.textContent = text;
  });
}

function setTextContent(id, text) {
  const elements = document.querySelectorAll(`#${id}, .${id}`);
  elements.forEach((el) => {
    el.textContent = text;
  });
}

function setHref(id, url) {
  const elements = document.querySelectorAll(`#${id}, .${id}`);
  elements.forEach((el) => {
    el.href = url;
  });
}

/**
 * Setup event listeners for forms, buttons, and copy actions.
 */
function setupEventListeners() {
  const urlInput = document.getElementById('target-url');
  const btnDetect = document.getElementById('btn-detect');
  const btnInfo = document.getElementById('btn-info');
  const btnExtract = document.getElementById('btn-extract');
  const btnDownload = document.getElementById('btn-download');
  const btnClear = document.getElementById('btn-clear');

  if (btnDetect) {
    btnDetect.addEventListener('click', (e) => {
      e.preventDefault();
      runFileDetection('detect');
    });
  }

  if (btnInfo) {
    btnInfo.addEventListener('click', (e) => {
      e.preventDefault();
      runFileDetection('info');
    });
  }

  if (btnExtract) {
    btnExtract.addEventListener('click', (e) => {
      e.preventDefault();
      runLinkDiscovery();
    });
  }

  if (btnDownload) {
    btnDownload.addEventListener('click', (e) => {
      e.preventDefault();
      runFileDownload();
    });
  }

  if (btnClear) {
    btnClear.addEventListener('click', (e) => {
      e.preventDefault();
      if (urlInput) urlInput.value = '';
      hideResults();
      hideLinksCard();
    });
  }

  // Copy buttons
  document.querySelectorAll('.btn-copy').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      let textToCopy = '';
      if (targetId) {
        const targetEl = document.getElementById(targetId) || document.querySelector(`.${targetId}`);
        if (targetEl) {
          textToCopy = targetEl.textContent.trim();
        }
      } else if (btn.getAttribute('data-text')) {
        textToCopy = btn.getAttribute('data-text');
      }

      if (textToCopy && textToCopy !== 'Detecting...' && !textToCopy.startsWith('Awaiting')) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          const originalTitle = btn.getAttribute('title') || '';
          btn.setAttribute('title', 'Copied!');
          btn.style.color = '#10B981';
          setTimeout(() => {
            btn.setAttribute('title', originalTitle);
            btn.style.color = '';
          }, 2000);
        });
      }
    });
  });
}

/**
 * Setup clickable sample URL buttons.
 */
function setupSampleButtons() {
  document.querySelectorAll('.sample-url-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-url');
      const input = document.getElementById('target-url');
      if (input && url) {
        input.value = url;
        runFileDetection('detect');
      }
    });
  });
}

/**
 * Executes file detection or metadata info via the same-origin backend proxy.
 * This guarantees that API keys are never exposed in browser JavaScript.
 */
async function runFileDetection(action = 'detect') {
  const urlInput = document.getElementById('target-url');
  if (!urlInput) return;
  const rawUrl = urlInput.value.trim();

  hideAlerts();
  if (!rawUrl) {
    showAlert('error-box', 'Please enter a valid HTTP or HTTPS file URL.');
    return;
  }

  if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
    showAlert('error-box', 'Invalid URL scheme. Only HTTP and HTTPS URLs are permitted.');
    return;
  }

  setLoading(true);

  try {
    const endpoint = action === 'info' ? '/api/internal/info' : '/api/internal/detect';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Sec-Fetch-Site': 'same-origin'
      },
      body: JSON.stringify({ url: rawUrl })
    });

    const envelope = await res.json();
    setLoading(false);

    if (!envelope.success) {
      const msg = envelope.error?.message || 'Could not process the submitted URL.';
      showAlert('error-box', `${envelope.error?.code ? `[${envelope.error.code}] ` : ''}${msg}`);
      hideResults();
      return;
    }

    currentFileInfo = envelope.data;
    displayResults(currentFileInfo);
  } catch (err) {
    setLoading(false);
    showAlert('error-box', `Network error: ${err.message}. Ensure the API server is running.`);
    hideResults();
  }
}

/**
 * Displays structured file results.
 */
function displayResults(data) {
  const resultsCard = document.getElementById('results-card');
  if (!resultsCard) return;

  resultsCard.classList.add('active');

  setTextContent('res-filename', data.safeFilename || data.filename || 'Unknown');
  setTextContent('res-mimetype', data.detectedMimeType || data.mimeType || 'Unknown');
  setTextContent('res-format', data.description || (data.extension ? `${data.extension.toUpperCase()} File` : 'Unknown'));
  setTextContent('res-size', data.sizeHuman || (data.sizeBytes ? `${data.sizeBytes} bytes` : 'Unknown'));
  setTextContent('res-status', data.formatStatus ? data.formatStatus.toUpperCase() : 'UNKNOWN');
  setTextContent('res-ranges', data.supportsRanges ? 'Supported (206 Partial Content)' : 'Not Supported');

  // Format Status Badge
  const statusEl = document.getElementById('res-status');
  if (statusEl) {
    statusEl.className = `tag ${data.formatStatus === 'verified' ? 'status-live' : 'status-waiting'}`;
  }

  // Security Warnings
  const warningsBox = document.getElementById('warnings-box');
  if (warningsBox) {
    if (data.securityWarnings && data.securityWarnings.length > 0) {
      warningsBox.style.display = 'block';
      warningsBox.innerHTML = `<strong>Security Notice:</strong><ul>${data.securityWarnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>`;
    } else {
      warningsBox.style.display = 'none';
    }
  }

  // Raw JSON
  const rawJsonEl = document.getElementById('res-raw-json');
  if (rawJsonEl) {
    rawJsonEl.textContent = JSON.stringify(data, null, 2);
  }

  // Enable download button if downloadable
  const btnDownload = document.getElementById('btn-download');
  if (btnDownload) {
    btnDownload.disabled = !data.downloadAvailable;
  }
}

/**
 * Streams the file download with real-time browser progress and saves with safe filename.
 */
async function runFileDownload() {
  const urlInput = document.getElementById('target-url');
  if (!urlInput) return;
  const rawUrl = urlInput.value.trim();

  if (!rawUrl) {
    showAlert('error-box', 'Please enter a URL to download.');
    return;
  }

  hideAlerts();
  showProgress(true);
  updateProgress(0, 'Connecting to stream proxy...');

  downloadAbortController = new AbortController();

  try {
    const res = await fetch('/api/internal/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Sec-Fetch-Site': 'same-origin'
      },
      body: JSON.stringify({ url: rawUrl, mode: 'stream' }),
      signal: downloadAbortController.signal
    });

    if (!res.ok) {
      showProgress(false);
      let errorMsg = `Download failed with HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson.error?.message) errorMsg = errJson.error.message;
      } catch {
        // Not JSON
      }
      showAlert('error-box', errorMsg);
      return;
    }

    // Extract filename from Content-Disposition header
    const disposition = res.headers.get('content-disposition');
    let filename = currentFileInfo?.safeFilename || 'download.bin';
    if (disposition) {
      const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";\r\n]+)"?/i);
      if (match && match[1]) {
        try {
          filename = decodeURIComponent(match[1]);
        } catch {
          filename = match[1];
        }
      }
    }

    // Read stream with progress tracking
    const contentLengthHeader = res.headers.get('content-length');
    const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : null;
    const reader = res.body.getReader();
    const chunks = [];
    let receivedBytes = 0;

    const isDeterminate = totalBytes && totalBytes > 0;
    setProgressIndeterminate(!isDeterminate);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      receivedBytes += value.length;

      if (isDeterminate) {
        const percent = Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
        updateProgress(percent, `${formatBytes(receivedBytes)} of ${formatBytes(totalBytes)} (${percent}%)`);
      } else {
        updateProgress(100, `${formatBytes(receivedBytes)} downloaded (streaming)`);
      }
    }

    updateProgress(100, 'Download complete! Saving file...');

    // Trigger browser file save
    const blob = new Blob(chunks, { type: res.headers.get('content-type') || 'application/octet-stream' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      showProgress(false);
    }, 2000);
  } catch (err) {
    showProgress(false);
    if (err.name === 'AbortError') {
      showAlert('warn-box', 'Download was cancelled.');
    } else {
      showAlert('error-box', `Download stream error: ${err.message}`);
    }
  }
}

function showProgress(visible) {
  const container = document.getElementById('progress-container');
  if (container) {
    container.classList.toggle('active', visible);
  }
}

function updateProgress(percent, text) {
  const fill = document.getElementById('progress-bar-fill');
  const textEl = document.getElementById('progress-text');
  if (fill) fill.style.width = `${percent}%`;
  if (textEl) textEl.textContent = text;
}

function setProgressIndeterminate(indeterminate) {
  const fill = document.getElementById('progress-bar-fill');
  if (fill) {
    if (indeterminate) {
      fill.className = 'progress-bar-indeterminate';
    } else {
      fill.className = 'progress-bar-fill';
    }
  }
}

function setLoading(isLoading) {
  const btnDetect = document.getElementById('btn-detect');
  if (btnDetect) {
    btnDetect.disabled = isLoading;
    btnDetect.textContent = isLoading ? 'Inspecting...' : 'Detect File';
  }
}

function showAlert(id, message) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = message;
    el.classList.add('active');
  }
}

function hideAlerts() {
  document.querySelectorAll('.alert').forEach((el) => {
    el.classList.remove('active');
  });
}

function hideResults() {
  const resultsCard = document.getElementById('results-card');
  if (resultsCard) resultsCard.classList.remove('active');
  const btnDownload = document.getElementById('btn-download');
  if (btnDownload) btnDownload.disabled = true;
  hideAlerts();
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

/**
 * Discovers downloadable links on a target webpage via the backend proxy.
 */
async function runLinkDiscovery() {
  const urlInput = document.getElementById('target-url');
  if (!urlInput) return;
  const rawUrl = urlInput.value.trim();

  hideAlerts();
  if (!rawUrl) {
    showAlert('error-box', 'Please enter a valid HTTP or HTTPS webpage URL to discover links.');
    return;
  }

  if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
    showAlert('error-box', 'Invalid URL scheme. Only HTTP and HTTPS URLs are permitted.');
    return;
  }

  const btnExtract = document.getElementById('btn-extract');
  if (btnExtract) {
    btnExtract.disabled = true;
    btnExtract.innerHTML = 'Discovering...';
  }

  try {
    const res = await fetch('/api/internal/extract-links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Sec-Fetch-Site': 'same-origin'
      },
      body: JSON.stringify({ url: rawUrl, limit: 50 })
    });

    if (btnExtract) {
      btnExtract.disabled = false;
      btnExtract.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Discover Links`;
    }

    const envelope = await res.json();
    if (!envelope.success) {
      const msg = envelope.error?.message || 'Could not extract links from webpage.';
      showAlert('error-box', `${envelope.error?.code ? `[${envelope.error.code}] ` : ''}${msg}`);
      hideLinksCard();
      return;
    }

    displayDiscoveredLinks(envelope.data);
  } catch (err) {
    if (btnExtract) {
      btnExtract.disabled = false;
      btnExtract.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Discover Links`;
    }
    showAlert('error-box', `Network error: ${err.message}. Ensure the API server is running.`);
    hideLinksCard();
  }
}

/**
 * Displays discovered links in the dashboard.
 */
function displayDiscoveredLinks(data) {
  const linksCard = document.getElementById('links-card');
  const linksList = document.getElementById('links-list');
  const countEl = document.getElementById('links-count');
  if (!linksCard || !linksList) return;

  const links = data?.links || [];
  if (countEl) countEl.textContent = links.length;

  if (links.length === 0) {
    linksList.innerHTML = '<div style="color: var(--gray-500); padding: 1rem; text-align: center;">No downloadable links discovered on this webpage.</div>';
    linksCard.classList.add('active');
    return;
  }

  linksList.innerHTML = '';
  links.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'link-discovery-item';

    const extBadge = item.extension
      ? `<span class="tag" style="background:#EEF2FF;color:#4F46E5;font-weight:600;">.${escapeHtml(item.extension)}</span>`
      : '<span class="tag" style="background:var(--gray-100);color:var(--gray-600);">link</span>';

    row.innerHTML = `
      <div class="link-discovery-info">
        ${extBadge}
        <span class="link-discovery-url" title="${escapeHtml(item.url)}">${escapeHtml(item.label || item.url)}</span>
      </div>
      <div class="link-discovery-actions">
        <button class="btn btn-secondary btn-sm btn-inspect-link" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" data-url="${escapeHtml(item.url)}">
          Inspect
        </button>
      </div>
    `;

    const inspectBtn = row.querySelector('.btn-inspect-link');
    if (inspectBtn) {
      inspectBtn.addEventListener('click', () => {
        const input = document.getElementById('target-url');
        if (input) {
          input.value = item.url;
          window.scrollTo({ top: input.offsetTop - 100, behavior: 'smooth' });
          runFileDetection('detect');
        }
      });
    }

    linksList.appendChild(row);
  });

  linksCard.classList.add('active');
}

function hideLinksCard() {
  const linksCard = document.getElementById('links-card');
  if (linksCard) linksCard.classList.remove('active');
}

