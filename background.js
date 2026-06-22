// === eCourt Auto Screenshot - Background Service Worker ===

const NATIVE_HOST_NAME = 'com.xianjieng.ecourtautoscreenshot';
const SCREENSHOT_SUBFOLDER = 'eCourt Auto Screenshot';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'capture') {
    captureAndDownload(sender?.tab, message.filename, message.reason, message.credentialData)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error('[AutoScreenshot] ❌ Unhandled capture error:', err);
        sendResponse({ ok: false, error: String(err) });
      });
    return true;
  }
});

async function resolveTargetTab(tab) {
  if (tab?.id != null && tab?.windowId != null) return tab;

  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tabs && tabs[0] && tabs[0].id != null) return tabs[0];

  throw new Error('No active tab found for capture');
}

function getDateFolder() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildScreenshotPath(filename) {
  return `${SCREENSHOT_SUBFOLDER}/${getDateFolder()}/${filename}.png`;
}

async function downloadDataUrl(dataUrl, filename) {
  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new Error('Invalid screenshot data URL');
  }

  const downloadPath = buildScreenshotPath(filename);

  return await chrome.downloads.download({
    url: dataUrl,
    filename: downloadPath,
    saveAs: false
  });
}

async function flashBadge(tabId, text = 'OK') {
  if (tabId == null) return;

  try {
    await chrome.action.setBadgeText({ text, tabId });
    await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '', tabId }).catch(() => {});
    }, 2000);
  } catch (err) {
    console.warn('[AutoScreenshot] Badge update skipped:', err);
  }
}

function sanitizeRecordText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function makeRecord(record) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    capturedAt: new Date().toISOString(),
    username: sanitizeRecordText(record?.username),
    password: sanitizeRecordText(record?.password),
    screenshotFile: sanitizeRecordText(record?.screenshotFile),
    reason: sanitizeRecordText(record?.reason),
    sourceText: sanitizeRecordText(record?.sourceText)
  };
}

async function syncRecordToNativeHost(record) {
  try {
    const response = await chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, {
      action: 'append_record',
      record
    });

    const nativeStatus = {
      enabled: true,
      ok: !!response?.ok,
      path: response?.path || '',
      count: response?.count ?? null,
      updatedAt: new Date().toISOString(),
      error: response?.ok ? '' : (response?.error || 'Unknown native host error')
    };

    await chrome.storage.local.set({ nativeBackupStatus: nativeStatus });

    if (!response?.ok) {
      console.warn('[AutoScreenshot] Native host returned error:', response);
    } else {
      console.log(`[AutoScreenshot] 💾 Native JSON updated: ${response.path}`);
    }
  } catch (err) {
    const nativeStatus = {
      enabled: false,
      ok: false,
      path: '',
      count: null,
      updatedAt: new Date().toISOString(),
      error: String(err)
    };
    await chrome.storage.local.set({ nativeBackupStatus: nativeStatus });
    console.warn('[AutoScreenshot] Native host unavailable:', err);
  }
}

async function saveCredentialRecord(record) {
  if (!record?.username && !record?.password) return;

  const current = await chrome.storage.local.get({ credentialLogs: [] });
  const logs = Array.isArray(current.credentialLogs) ? current.credentialLogs : [];
  const normalized = makeRecord(record);

  logs.push(normalized);
  await chrome.storage.local.set({ credentialLogs: logs });
  console.log(`[AutoScreenshot] 📝 Saved credential record (${logs.length} total)`);

  await syncRecordToNativeHost(normalized);
}

async function captureAndDownload(tab, filename, reason, credentialData = null) {
  const targetTab = await resolveTargetTab(tab);

  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(targetTab.windowId, {
      format: 'png'
    });

    const downloadId = await downloadDataUrl(dataUrl, filename);
    const screenshotFile = buildScreenshotPath(filename);

    console.log(`[AutoScreenshot] ✅ Downloaded: ${screenshotFile} (id: ${downloadId}, reason: ${reason})`);

    await saveCredentialRecord({
      ...(credentialData || {}),
      screenshotFile,
      reason
    });

    await flashBadge(targetTab.id);
    return;

  } catch (err) {
    console.error('[AutoScreenshot] ❌ Primary capture failed:', err);
  }

  // fallback: inject html2canvas into page and render DOM manually
  try {
    await chrome.scripting.executeScript({
      target: { tabId: targetTab.id },
      files: ['html2canvas.min.js']
    });

    const results = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id },
      func: async () => {
        if (typeof html2canvas === 'undefined') return null;

        const canvas = await html2canvas(document.body, {
          useCORS: true,
          allowTaint: true,
          scale: 1,
          logging: false
        });

        return canvas.toDataURL('image/png');
      }
    });

    const dataUrl = results?.[0]?.result;
    if (!dataUrl) {
      throw new Error('html2canvas returned empty result');
    }

    const downloadId = await downloadDataUrl(dataUrl, filename);
    const screenshotFile = buildScreenshotPath(filename);

    console.log(`[AutoScreenshot] ✅ Fallback downloaded: ${screenshotFile} (id: ${downloadId}, reason: ${reason})`);

    await saveCredentialRecord({
      ...(credentialData || {}),
      screenshotFile,
      reason
    });

    await flashBadge(targetTab.id, 'OK');

  } catch (fallbackErr) {
    console.error('[AutoScreenshot] ❌ Fallback also failed:', fallbackErr);
    throw fallbackErr;
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[AutoScreenshot] Extension installed');
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' }).catch(() => {});
  try {
    const status = await chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, { action: 'get_status' });
    await chrome.storage.local.set({
      nativeBackupStatus: {
        enabled: !!status?.ok,
        ok: !!status?.ok,
        path: status?.path || '',
        count: status?.count ?? null,
        updatedAt: new Date().toISOString(),
        error: status?.ok ? '' : (status?.error || '')
      }
    });
  } catch (err) {
    await chrome.storage.local.set({
      nativeBackupStatus: {
        enabled: false,
        ok: false,
        path: '',
        count: null,
        updatedAt: new Date().toISOString(),
        error: String(err)
      }
    });
  }
});
