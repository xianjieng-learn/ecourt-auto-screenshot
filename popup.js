// === eCourt Auto Screenshot - Popup Script ===

const toggleAuto = document.getElementById('toggleAuto');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const btnManual = document.getElementById('btnManual');
const btnScan = document.getElementById('btnScan');

function updateUI(enabled) {
  statusDot.className = enabled ? 'dot on' : 'dot off';
  statusText.textContent = enabled
    ? 'Active — watching for popups'
    : 'Paused — not watching';
}

// load state
chrome.storage.local.get({ autoEnabled: true }, (data) => {
  toggleAuto.checked = data.autoEnabled;
  updateUI(data.autoEnabled);
});

// toggle
toggleAuto.addEventListener('change', () => {
  const enabled = toggleAuto.checked;
  chrome.storage.local.set({ autoEnabled: enabled });
  updateUI(enabled);

  // kirim ke content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'toggle',
        enabled: enabled
      }).catch(() => {});
    }
  });
});

// manual capture
btnManual.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'manual_capture'
      }).catch(() => {
        // fallback: capture langsung dari popup
        chrome.tabs.captureVisibleTab(tabs[0].windowId, {
          format: 'png'
        }).then(dataUrl => {
          const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          chrome.downloads.download({
            url: dataUrl,
            filename: `ecourt-manual-${now}.png`,
            saveAs: false
          });
        });
      });
    }
  });

  // feedback visual
  btnManual.textContent = '✅ Captured!';
  setTimeout(() => { btnManual.textContent = '📸 Screenshot Sekarang'; }, 1500);
});

// scan
btnScan.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'scan_now'
      }).catch(() => {});
    }
  });

  btnScan.textContent = '🔍 Scanning...';
  setTimeout(() => { btnScan.textContent = '🔍 Scan Ulang Halaman'; }, 1500);
});
