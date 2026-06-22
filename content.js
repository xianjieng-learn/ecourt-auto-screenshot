// === eCourt Auto Screenshot - Content Script ===
// Detects popup/modal elements and triggers auto-screenshot

(function () {
  'use strict';

  const CONFIG = {
    COOLDOWN_MS: 3000,        // anti-spam: jangan screenshot popup yang sama berulang
    DETECT_DELAY_MS: 500,     // tunggu render sebelum screenshot
    SCROLL_DELAY_MS: 800,     // tunggu setelah scroll
    KEYWORDS: [               // kata kunci credential yang lebih spesifik
      'username', 'password', 'kata sandi', 'user name',
      'userid', 'user id', 'id user'
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

  function normalizeText(text) {
    return (text || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function looksLikeCredentialText(el) {
    const rawText = el.innerText || el.textContent || '';
    const text = normalizeText(rawText);
    if (!text) return false;

    // khusus popup eCourt model "Pesan" + "Data user"
    const hasPesanTitle = /(^|\b)pesan(\b|$)/i.test(rawText);
    const hasDataUser = /data\s*user/i.test(rawText);
    const hasUsernameLine = /username\s*:/i.test(rawText);
    const hasUserLine = /user\s*:/i.test(rawText);
    const hasPasswordLine = /password\s*:/i.test(rawText);

    // wajib struktur khas popup yang Xian kirim
    if (!(hasDataUser && (hasUsernameLine || hasUserLine) && hasPasswordLine)) return false;

    // "Pesan" biasanya ada di header modal. kalau gak ada, tetap lolos asal format data user sangat spesifik.
    const specificCredentialShape = hasDataUser && (hasUsernameLine || hasUserLine) && hasPasswordLine;
    const ecourtMessageShape = hasPesanTitle && specificCredentialShape;

    if (!(specificCredentialShape || ecourtMessageShape)) return false;

    // batas panjang supaya container besar/full page gak ikut match
    if (text.length > 500) return false;

    return true;
  }

  function isReasonablePopupSize(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;

    if (rect.width < 120 || rect.height < 40) return false;
    if (rect.width > vw * 0.75 || rect.height > vh * 0.65) return false;

    return true;
  }

  // cek apakah ada input type password di dalam element
  function hasPasswordField(el) {
    if (!el || !el.querySelectorAll) return false;
    // input type password
    if (el.querySelectorAll('input[type="password"]').length > 0) return true;
    // input dengan name/id yang mengandung kata password/sandi
    const inputs = el.querySelectorAll('input[type="text"], input:not([type])');
    for (const inp of inputs) {
      const name = (inp.name || inp.id || inp.placeholder || '').toLowerCase();
      if (name.includes('password') || name.includes('sandi') || name.includes('user')) {
        return true;
      }
    }
    return false;
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
  function isOverlayLike(el) {
    // elemen yang muncul di atas konten lain (popup, toast, notifikasi, dll)
    if (!el || !el.tagName) return false;
    const style = window.getComputedStyle(el);
    const pos = style.position;
    const z = parseInt(style.zIndex, 10);
    // fixed/absolute + z-index tinggi
    if ((pos === 'fixed' || pos === 'absolute') && !isNaN(z) && z >= 100) return true;
    // atau match selector modal
    if (isModalElement(el)) return true;
    return false;
  }

  function isCredentialCandidate(el) {
    if (!el || !isOnScreen(el)) return false;

    if (hasPasswordField(el)) return true;
    if (!looksLikeCredentialText(el)) return false;
    if (!isReasonablePopupSize(el)) return false;
    if (!(isModalElement(el) || isOverlayLike(el))) return false;

    return true;
  }

  function checkElement(el) {
    if (!enabled || !el || !el.tagName) return;
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK') return;
    if (!isOnScreen(el)) return;

    // 1. elemen itu sendiri kandidat credential popup
    if (isCredentialCandidate(el)) {
      triggerScreenshot('credential-candidate:self');
      return;
    }

    // 2. check children dari elemen baru
    if (el.querySelectorAll) {
      const children = el.querySelectorAll(CONFIG.MODAL_SELECTORS.join(','));
      for (const child of children) {
        if (!isOnScreen(child)) continue;
        if (isCredentialCandidate(child)) {
          triggerScreenshot('credential-candidate:child');
          return;
        }
      }

      // 3. fallback: cari descendant kecil yang bukan modal selector standar
      const descendants = el.querySelectorAll('div, section, article, aside');
      for (const node of descendants) {
        if (isCredentialCandidate(node)) {
          triggerScreenshot('credential-candidate:descendant');
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

    // fallback: scan elemen positioned yang mungkin popup custom
    document.querySelectorAll('div, section, article, aside').forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.position === 'fixed' || style.position === 'absolute') {
        checkElement(el);
      }
    });
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
