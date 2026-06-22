// === eCourt Auto Screenshot - Background Service Worker ===

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'capture') {
    captureAndDownload(sender.tab, message.filename, message.reason);
    sendResponse({ ok: true });
  }
});

async function captureAndDownload(tab, filename, reason) {
  try {
    // capture visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png',
      quality: 100
    });

    // download
    const downloadUrl = dataUrl; // langsung dari data URL
    const downloadFilename = `${filename}.png`;

    const downloadId = await chrome.downloads.download({
      url: downloadUrl,
      filename: downloadFilename,
      saveAs: false  // auto-download tanpa dialog
    });

    console.log(`[AutoScreenshot] ✅ Downloaded: ${downloadFilename} (id: ${downloadId}, reason: ${reason})`);

    // update badge
    chrome.action.setBadgeText({ text: '📸', tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId: tab.id });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '', tabId: tab.id });
    }, 2000);

  } catch (err) {
    console.error('[AutoScreenshot] ❌ Capture failed:', err);
    // fallback: inject screenshot via html2canvas
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['html2canvas.min.js']
      });

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return new Promise((resolve) => {
            if (typeof html2canvas === 'undefined') {
              resolve(null);
              return;
            }
            html2canvas(document.body, {
              useCORS: true,
              allowTaint: true,
              scale: 1,
              logging: false
            }).then(canvas => resolve(canvas.toDataURL('image/png')));
          });
        }
      });

      if (results && results[0] && results[0].result) {
        await chrome.downloads.download({
          url: results[0].result,
          filename: `${filename}.png`,
          saveAs: false
        });
        console.log(`[AutoScreenshot] ✅ Fallback download: ${filename}.png`);
      }
    } catch (fallbackErr) {
      console.error('[AutoScreenshot] ❌ Fallback also failed:', fallbackErr);
    }
  }
}

// Badge awal
chrome.runtime.onInstalled.addListener(() => {
  console.log('[AutoScreenshot] Extension installed');
  chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
});
