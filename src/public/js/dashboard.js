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
  const { deploymentStatus, publicBaseUrl, apiBaseUrl, docsUrl, healthUrl, testPageUrl, apiKeyRequired } = config;

  // 1. Update Status Pill
  if (deploymentStatus === 'live') {
    updateStatusPill('live', 'Live & Operational');
  } else if (deploymentStatus === 'local_development') {
    updateStatusPill('live', 'Local Development');
  } else {
    updateStatusPill('waiting', 'Configuration Required');
  }

  // 2. Update Live URLs
  setTextContent('display-app-name', config.appName || 'SMMpro File Downloader');
  setTextContent('display-public-url', publicBaseUrl || 'Not configured (set PUBLIC_BASE_URL)');
  setTextContent('display-api-url', apiBaseUrl || '/api/v1');
  setTextContent('display-health-url', healthUrl || '/api/v1/health');
  setTextContent('display-docs-url', docsUrl || '/api/docs');
  setTextContent('display-test-url', testPageUrl || '/test');
  setTextContent('display-auth-status', apiKeyRequired ? 'API Key Required (X-API-Key)' : 'Public (No key required)');

  // 3. Update Link Hrefs
  setHref('link-docs', docsUrl || '/api/docs');
  setHref('link-health', healthUrl || '/api/v1/health');
  setHref('link-test', testPageUrl || '/test');

  // 4. Update curl code snippets with live API URL
  const base = apiBaseUrl || 'http://localhost:3000/api/v1';
  const curlDetect = `curl -X POST "${base}/files/detect" \\\n  -H "Content-Type: application/json" \\\n  -d '{"url":"https://example.com/file.zip"}'`;
  setTextContent('curl-detect-snippet', curlDetect);

  const curlDownload = `curl -fL -X POST "${base}/download" \\\n  -H "Content-Type: application/json" \\\n  -d '{"url":"https://example.com/file.zip","mode":"stream"}' \\\n  -o downloaded_file.zip`;
  setTextContent('curl-download-snippet', curlDownload);

  // If configuration help is needed, show warning box
  if (config.configurationHelp && deploymentStatus === 'configuration_required') {
    showAlert('warn-box', config.configurationHelp);
  }
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
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setHref(id, url) {
  const el = document.getElementById(id);
  if (el) el.href = url;
}

/**
 * Setup event listeners for forms, buttons, and copy actions.
 */
function setupEventListeners() {
  const urlInput = document.getElementById('target-url');
  const btnDetect = document.getElementById('btn-detect');
  const btnInfo = document.getElementById('btn-info');
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
    });
  }

  // Copy buttons
  document.querySelectorAll('.btn-copy').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      let textToCopy = '';
      if (targetId) {
        const targetEl = document.getElementById(targetId);
        textToCopy = targetEl ? targetEl.textContent.trim() : '';
      } else if (btn.getAttribute('data-text')) {
        textToCopy = btn.getAttribute('data-text');
      }

      if (textToCopy) {
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
  return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}
