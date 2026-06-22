// === eCourt Auto Screenshot - Content Script ===
// Detects popup/modal elements and triggers auto-screenshot

(function () {
  'use strict';

  const CONFIG = {
    COOLDOWN_MS: 3000,        // anti-spam: jangan screenshot popup yang sama berulang
    DETECT_DELAY_MS: 500,     // tunggu render sebelum screenshot
    SCROLL_DELAY_MS: 800,     // tunggu setelah scroll
    KEYWORDS: [               // kata kunci yang biasa muncul di popup credential
      'username', 'password', 'sandi', 'kata sandi',
      'user name', 'login', 'masuk', 'otentikasi',
      'authentication', 'credential', 'token'
    ],
    MODAL_SELECTORS: [        // selector umum popup/modal
      '.modal', '.modal-dialog', '.modal-content',
      '[role="dialog"]', '[role="alertdialog"]',
      '.ui-dialog', '.popup', '.overlay',
      '.swal', '.swal2', '.swal2-container',
      '[class*="modal"]', '[class*="dialog"]',
      '[class*="popup"]', '[class*="overlay"]',
      '[id*="modal"]', '[id*="dialog"]',
      '[id*="popup"]', '[id*="alert"]'
    ]
  };

  let enabled = true;
  let lastScreenshotTime = 0;
  let observer = null;

  // === Utility ===
  function timestamp() {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  }

  function isOnScreen(el) {
    if (!el.getBoundingClientRect) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return (
      rect.width > 50 &&
      rect.height > 50 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      parseFloat(style.opacity) > 0.1
    );
  }

  function hasHighZIndex(el) {
    const style = window.getComputedStyle(el);
    const z = parseInt(style.zIndex, 10);
    const pos = style.position;
    return (
      (pos === 'fixed' || pos === 'absolute') &&
      !isNaN(z) && z >= 1000
    );
  }

  function containsKeywords(el) {
    const text = (el.innerText || el.textContent || '').toLowerCase();
    return CONFIG.KEYWORDS.some(kw => text.includes(kw));
  }

  function isModalElement(el) {
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toLowerCase();

    // cek selector match
    for (const sel of CONFIG.MODAL_SELECTORS) {
      try {
        if (el.matches(sel) || el.querySelector(sel)) return true;
      } catch (e) { /* invalid selector skip */ }
    }

    // cek z-index tinggi + positioned
    if (hasHighZIndex(el)) return true;

    // cek backdrop overlay (fixed, full screen, gelap)
    const style = window.getComputedStyle(el);
    if (style.position === 'fixed' && el.offsetWidth > window.innerWidth * 0.5) {
      return true;
    }

    return false;
  }

  // === Screenshot Logic ===
  function triggerScreenshot(reason) {
    const now = Date.now();
    if (now - lastScreenshotTime < CONFIG.COOLDOWN_MS) return;
    lastScreenshotTime = now;

    const name = `ecourt-popup-${timestamp()}`;
    console.log(`[AutoScreenshot] 📸 Detected: ${reason} → capturing...`);

    // tunggu render selesai
    setTimeout(() => {
      chrome.runtime.sendMessage({
        action: 'capture',
        filename: name,
        reason: reason
      });
    }, CONFIG.DETECT_DELAY_MS);
  }

  // === Detection ===
  function checkElement(el) {
    if (!enabled || !el || !el.tagName) return;
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK') return;
    if (!isOnScreen(el)) return;

    if (isModalElement(el) && containsKeywords(el)) {
      triggerScreenshot('modal+keywords');
      return;
    }

    if (isModalElement(el)) {
      triggerScreenshot('modal-detected');
      return;
    }

    // check children
    if (el.querySelectorAll) {
      const children = el.querySelectorAll(CONFIG.MODAL_SELECTORS.join(','));
      for (const child of children) {
        if (isOnScreen(child) && containsKeywords(child)) {
          triggerScreenshot('child-modal+keywords');
          return;
        }
      }
    }
  }

  // === MutationObserver ===
  function startObserver() {
    if (observer) return;

    observer = new MutationObserver((mutations) => {
      if (!enabled) return;

      for (const mutation of mutations) {
        // elemen baru ditambahkan
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            checkElement(node);
          }
        }

        // attribute berubah (misal class/visibility toggle)
        if (mutation.type === 'attributes' && mutation.target.nodeType === Node.ELEMENT_NODE) {
          checkElement(mutation.target);
        }
      }
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'aria-hidden', 'aria-modal', 'open']
    });

    console.log('[AutoScreenshot] 👁️ Observer started — watching for popups...');
  }

  // === Initial Scan ===
  function scanExisting() {
    if (!enabled) return;
    // scan elemen yang sudah ada (popup mungkin sudah ter-render)
    for (const sel of CONFIG.MODAL_SELECTORS) {
      try {
        document.querySelectorAll(sel).forEach(el => checkElement(el));
      } catch (e) { /* skip */ }
    }
  }

  // === Manual Trigger ===
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'manual_capture') {
      const name = `ecourt-manual-${timestamp()}`;
      chrome.runtime.sendMessage({
        action: 'capture',
        filename: name,
        reason: 'manual'
      });
      sendResponse({ ok: true });
    }

    if (msg.action === 'toggle') {
      enabled = msg.enabled;
      console.log(`[AutoScreenshot] ${enabled ? '✅ Enabled' : '⏸️ Disabled'}`);
      sendResponse({ enabled });
    }

    if (msg.action === 'scan_now') {
      scanExisting();
      sendResponse({ ok: true });
    }
  });

  // === Keyboard Shortcut (Alt+S) ===
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 's') {
      e.preventDefault();
      const name = `ecourt-manual-${timestamp()}`;
      chrome.runtime.sendMessage({
        action: 'capture',
        filename: name,
        reason: 'hotkey'
      });
    }
  });

  // === Boot ===
  function boot() {
    // baca state dari storage
    chrome.storage.local.get({ autoEnabled: true }, (data) => {
      enabled = data.autoEnabled;
      startObserver();
      setTimeout(scanExisting, 1000);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
