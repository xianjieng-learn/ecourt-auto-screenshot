// === eCourt Auto Screenshot - Popup Script ===

const toggleAuto = document.getElementById('toggleAuto');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const btnManual = document.getElementById('btnManual');
const btnScan = document.getElementById('btnScan');
const btnExportWord = document.getElementById('btnExportWord');
const btnExportJson = document.getElementById('btnExportJson');
const btnClearLogs = document.getElementById('btnClearLogs');
const recordCount = document.getElementById('recordCount');
const lastUser = document.getElementById('lastUser');
const lastShot = document.getElementById('lastShot');

function updateUI(enabled) {
  statusDot.className = enabled ? 'dot on' : 'dot off';
  statusText.textContent = enabled
    ? 'Active — watching for popups'
    : 'Paused — not watching';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function getLogs() {
  const data = await chrome.storage.local.get({ credentialLogs: [] });
  return Array.isArray(data.credentialLogs) ? data.credentialLogs : [];
}

async function refreshStats() {
  const data = await chrome.storage.local.get({ autoEnabled: true, credentialLogs: [] });
  const logs = Array.isArray(data.credentialLogs) ? data.credentialLogs : [];
  const latest = logs[logs.length - 1];

  toggleAuto.checked = data.autoEnabled;
  updateUI(data.autoEnabled);

  recordCount.textContent = String(logs.length);
  lastUser.textContent = latest?.username || '-';
  lastShot.textContent = latest?.screenshotFile || '-';
}

async function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({
      url,
      filename,
      saveAs: false
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

function formatDate(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('id-ID');
  } catch {
    return iso;
  }
}

async function sendToActiveTab(message) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]) return;
  try {
    await chrome.tabs.sendMessage(tabs[0].id, message);
  } catch {
    // ignore when content script not ready
  }
}

btnManual.addEventListener('click', async () => {
  await sendToActiveTab({ action: 'manual_capture' });
  btnManual.textContent = '✅ Captured!';
  setTimeout(() => { btnManual.textContent = '📸 Screenshot Sekarang'; }, 1500);
});

btnScan.addEventListener('click', async () => {
  await sendToActiveTab({ action: 'scan_now' });
  btnScan.textContent = '🔍 Scanning...';
  setTimeout(() => { btnScan.textContent = '🔍 Scan Ulang Halaman'; }, 1500);
});

toggleAuto.addEventListener('change', async () => {
  const enabled = toggleAuto.checked;
  await chrome.storage.local.set({ autoEnabled: enabled });
  updateUI(enabled);
  await sendToActiveTab({ action: 'toggle', enabled });
});

btnExportJson.addEventListener('click', async () => {
  const logs = await getLogs();
  const blob = new Blob([
    JSON.stringify({ exportedAt: new Date().toISOString(), total: logs.length, logs }, null, 2)
  ], { type: 'application/json' });

  await downloadBlob(blob, `ecourt-credentials-${timestamp()}.json`);
  btnExportJson.textContent = '✅ JSON Exported';
  setTimeout(() => { btnExportJson.textContent = '🗂️ Export JSON'; }, 1500);
});

btnExportWord.addEventListener('click', async () => {
  const logs = await getLogs();
  if (!logs.length) {
    btnExportWord.textContent = '⚠️ Belum ada data';
    setTimeout(() => { btnExportWord.textContent = '📝 Export ke Word'; }, 1500);
    return;
  }

  const rows = logs.map((log, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(formatDate(log.capturedAt))}</td>
      <td>${escapeHtml(log.username)}</td>
      <td>${escapeHtml(log.password)}</td>
      <td>${escapeHtml(log.screenshotFile)}</td>
      <td>${escapeHtml(log.reason)}</td>
    </tr>
  `).join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>eCourt Credential Export</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; }
        h1 { font-size: 18px; }
        p { margin: 6px 0; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #444; padding: 6px; text-align: left; }
        th { background: #dce6f1; }
      </style>
    </head>
    <body>
      <h1>eCourt Credential Export</h1>
      <p>Diexport: ${escapeHtml(formatDate(new Date().toISOString()))}</p>
      <p>Total record: ${logs.length}</p>
      <table>
        <thead>
          <tr>
            <th>No</th>
            <th>Waktu</th>
            <th>User</th>
            <th>Password</th>
            <th>Screenshot</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'application/msword' });
  await downloadBlob(blob, `ecourt-credentials-${timestamp()}.doc`);
  btnExportWord.textContent = '✅ Word Exported';
  setTimeout(() => { btnExportWord.textContent = '📝 Export ke Word'; }, 1500);
});

btnClearLogs.addEventListener('click', async () => {
  const ok = confirm('Hapus semua data user/password yang tersimpan?');
  if (!ok) return;

  await chrome.storage.local.set({ credentialLogs: [] });
  await refreshStats();
  btnClearLogs.textContent = '✅ Data Dihapus';
  setTimeout(() => { btnClearLogs.textContent = '🧹 Hapus Data Tersimpan'; }, 1500);
});

refreshStats().catch((err) => {
  console.error('[AutoScreenshot] Popup init error:', err);
});
