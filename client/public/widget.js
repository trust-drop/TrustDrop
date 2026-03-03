(function() {
  "use strict";

  /**
   * TrustDrop Embeddable Widget
   *
   * A self-contained, drop-in widget for creating encrypted one-time secrets.
   * Written in vanilla ES5 JavaScript for maximum browser compatibility.
   *
   * Embedding:
   *   <div id="trustdrop-widget"></div>
   *   <script src="https://trustdrop.com/widget.js"></script>
   *
   *   Or with a custom container:
   *   <div data-trustdrop-widget></div>
   *
   * Customization via data attributes:
   *   data-button-text   — Trigger button label (default: "Share a Secret")
   *   data-theme          — "dark" or "light" (default: "dark")
   *   data-accent-color   — CSS color for buttons/accents (default: "#2a7d6e")
   *   data-origin         — TrustDrop server origin (default: "https://trustdrop.com")
   *
   * Architecture:
   *   - Shadow DOM for complete style isolation from the host page
   *   - Self-contained AES-256-GCM encryption (mirrors the main app's crypto.ts)
   *   - State-driven rendering: all UI is rebuilt from state on every change
   *   - Zero external dependencies — all icons, styles, and crypto are inline
   *
   * Encryption Modes (identical to the main app):
   *   Mode A (No Password): Random 256-bit key placed in the URL fragment (#k=...)
   *     — The fragment is never sent to the server per HTTP specification
   *   Mode B (Password): Key derived via PBKDF2-SHA256 with 310,000 iterations
   *     — No key in the URL; recipient must know the password separately
   */

  // Default TrustDrop server origin, overridable via data-origin attribute
  var TRUSTDROP_ORIGIN = "https://trustdrop.com";

  /* =========================================================================
   * Cryptographic Utilities
   *
   * These functions mirror the main app's crypto.ts module. They implement
   * client-side AES-256-GCM encryption so that plaintext never leaves the
   * browser. The server only ever receives ciphertext.
   * ========================================================================= */

  // Converts an ArrayBuffer to standard base64 encoding.
  // Used internally for encoding ciphertext, IVs, and salts before JSON transport.
  function arrayBufferToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = "";
    for (var i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Converts an ArrayBuffer to base64url encoding (URL-safe, no padding).
  // Used for the encryption key placed in the URL fragment (#k=...).
  function arrayBufferToBase64url(buffer) {
    return arrayBufferToBase64(buffer)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  // Mode A key generation: creates a random 256-bit AES-GCM key via WebCrypto.
  // The key is exportable so it can be serialized into the URL fragment.
  async function generateKey() {
    return crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }

  // Exports a CryptoKey to base64url format for placement in the URL fragment.
  // The exported key is the raw 32-byte AES key material.
  async function exportKeyToBase64url(key) {
    var raw = await crypto.subtle.exportKey("raw", key);
    return arrayBufferToBase64url(raw);
  }

  // Mode B key derivation: derives an AES-256-GCM key from a user password.
  // Uses PBKDF2 with SHA-256 and 310,000 iterations (OWASP 2023 recommendation).
  // The 16-byte random salt ensures unique keys even for identical passwords.
  // The derived key is non-exportable (it stays in the browser's crypto subsystem).
  async function deriveKeyFromPassword(password, salt) {
    var encoder = new TextEncoder();
    var passwordKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: salt, iterations: 310000, hash: "SHA-256" },
      passwordKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  // Encrypts a text message using AES-256-GCM.
  // Mode A (no password): generates a random key; returns keyBase64url for the URL fragment.
  // Mode B (with password): derives key from password + random salt; no key in URL.
  // Both modes use a random 12-byte IV for semantic security.
  async function encryptMessage(message, password) {
    var encoder = new TextEncoder();
    var data = encoder.encode(message);
    var key, salt, keyBase64url;

    if (password) {
      // Mode B: password-derived key with random salt
      salt = crypto.getRandomValues(new Uint8Array(16)).buffer;
      key = await deriveKeyFromPassword(password, salt);
    } else {
      // Mode A: random key exported for URL fragment
      key = await generateKey();
      keyBase64url = await exportKeyToBase64url(key);
    }

    // 12-byte random IV ensures the same plaintext encrypts differently each time
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      data
    );

    return {
      ciphertext_b64: arrayBufferToBase64(ciphertext),
      iv: arrayBufferToBase64(iv.buffer),
      salt: salt ? arrayBufferToBase64(salt) : undefined,
      keyBase64url: keyBase64url  // Only set in Mode A (no password)
    };
  }

  // Encrypts raw file data (ArrayBuffer) using AES-256-GCM.
  // Identical encryption logic to encryptMessage but operates on binary data directly.
  async function encryptFile(fileData, password) {
    var key, salt, keyBase64url;

    if (password) {
      // Mode B: password-derived key with random salt
      salt = crypto.getRandomValues(new Uint8Array(16)).buffer;
      key = await deriveKeyFromPassword(password, salt);
    } else {
      // Mode A: random key exported for URL fragment
      key = await generateKey();
      keyBase64url = await exportKeyToBase64url(key);
    }

    // 12-byte random IV for AES-GCM authenticated encryption
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      fileData
    );

    return {
      ciphertext_b64: arrayBufferToBase64(ciphertext),
      iv: arrayBufferToBase64(iv.buffer),
      salt: salt ? arrayBufferToBase64(salt) : undefined,
      keyBase64url: keyBase64url  // Only set in Mode A (no password)
    };
  }

  /* =========================================================================
   * Dynamic CSS Generation
   *
   * All styles are scoped inside the Shadow DOM, so they cannot leak into
   * or be affected by the host page's styles. Supports light/dark themes
   * and custom accent colors via the data-theme and data-accent-color attributes.
   * ========================================================================= */
  function getStyles(config) {
    var accent = config.accentColor || "#2a7d6e";
    var theme = config.theme || "dark";
    var isDark = theme === "dark";
    var bg = isDark ? "#0f1729" : "#ffffff";
    var bgSecondary = isDark ? "#1a2332" : "#f8f9fa";
    var text = isDark ? "#e2e8f0" : "#1a202c";
    var textMuted = isDark ? "#94a3b8" : "#718096";
    var border = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)";
    var inputBg = isDark ? "#1e293b" : "#f1f5f9";

    return "\n\
      * { box-sizing: border-box; margin: 0; padding: 0; }\n\
      :host { display: inline-block; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }\n\
      .td-trigger {\n\
        display: inline-flex; align-items: center; gap: 8px;\n\
        padding: 10px 20px; border: none; border-radius: 8px;\n\
        background: " + accent + "; color: #fff;\n\
        font-size: 14px; font-weight: 600; cursor: pointer;\n\
        transition: opacity 0.15s, transform 0.1s;\n\
        font-family: inherit;\n\
      }\n\
      .td-trigger:hover { opacity: 0.9; }\n\
      .td-trigger:active { transform: scale(0.98); }\n\
      .td-trigger svg { width: 16px; height: 16px; }\n\
      .td-overlay {\n\
        position: fixed; inset: 0; z-index: 999999;\n\
        background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);\n\
        display: flex; align-items: center; justify-content: center;\n\
        padding: 16px; opacity: 0; transition: opacity 0.2s;\n\
      }\n\
      .td-overlay.visible { opacity: 1; }\n\
      .td-modal {\n\
        background: " + bg + "; color: " + text + ";\n\
        border-radius: 16px; width: 100%; max-width: 460px;\n\
        max-height: 90vh; overflow-y: auto;\n\
        box-shadow: 0 25px 50px rgba(0,0,0,0.25);\n\
        border: 1px solid " + border + ";\n\
        transform: translateY(10px); transition: transform 0.2s;\n\
      }\n\
      .td-overlay.visible .td-modal { transform: translateY(0); }\n\
      .td-header {\n\
        display: flex; align-items: center; justify-content: space-between;\n\
        padding: 20px 24px 0; \n\
      }\n\
      .td-header-left { display: flex; align-items: center; gap: 10px; }\n\
      .td-header-left svg { width: 20px; height: 20px; color: " + accent + "; }\n\
      .td-header h2 { font-size: 18px; font-weight: 700; }\n\
      .td-close {\n\
        background: none; border: none; color: " + textMuted + ";\n\
        cursor: pointer; padding: 4px; border-radius: 6px;\n\
        display: flex; align-items: center; justify-content: center;\n\
      }\n\
      .td-close:hover { color: " + text + "; background: " + bgSecondary + "; }\n\
      .td-close svg { width: 20px; height: 20px; }\n\
      .td-body { padding: 20px 24px 24px; }\n\
      .td-tabs {\n\
        display: flex; gap: 0; margin-bottom: 16px;\n\
        background: " + bgSecondary + "; border-radius: 8px; padding: 3px;\n\
      }\n\
      .td-tab {\n\
        flex: 1; padding: 8px 0; border: none; border-radius: 6px;\n\
        background: transparent; color: " + textMuted + ";\n\
        font-size: 13px; font-weight: 500; cursor: pointer;\n\
        transition: all 0.15s; font-family: inherit;\n\
      }\n\
      .td-tab.active { background: " + accent + "; color: #fff; }\n\
      .td-field { margin-bottom: 14px; }\n\
      .td-label {\n\
        display: block; font-size: 12px; font-weight: 600;\n\
        color: " + textMuted + "; margin-bottom: 6px; text-transform: uppercase;\n\
        letter-spacing: 0.5px;\n\
      }\n\
      .td-textarea, .td-input, .td-select {\n\
        width: 100%; padding: 10px 12px; border-radius: 8px;\n\
        border: 1px solid " + border + "; background: " + inputBg + ";\n\
        color: " + text + "; font-size: 14px; font-family: inherit;\n\
        outline: none; transition: border-color 0.15s;\n\
      }\n\
      .td-textarea:focus, .td-input:focus, .td-select:focus {\n\
        border-color: " + accent + ";\n\
      }\n\
      .td-textarea { resize: vertical; min-height: 100px; }\n\
      .td-select { cursor: pointer; -webkit-appearance: none; appearance: none;\n\
        background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='" + encodeURIComponent(textMuted) + "' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E\");\n\
        background-repeat: no-repeat; background-position: right 12px center;\n\
        padding-right: 32px;\n\
      }\n\
      .td-row { display: flex; gap: 10px; }\n\
      .td-row .td-field { flex: 1; }\n\
      .td-checkbox-row {\n\
        display: flex; align-items: center; gap: 8px;\n\
        margin-bottom: 16px;\n\
      }\n\
      .td-checkbox {\n\
        width: 16px; height: 16px; accent-color: " + accent + "; cursor: pointer;\n\
      }\n\
      .td-checkbox-label { font-size: 13px; color: " + textMuted + "; cursor: pointer; }\n\
      .td-file-drop {\n\
        border: 2px dashed " + border + "; border-radius: 8px;\n\
        padding: 24px; text-align: center; cursor: pointer;\n\
        transition: border-color 0.15s; margin-bottom: 14px;\n\
      }\n\
      .td-file-drop:hover { border-color: " + accent + "; }\n\
      .td-file-drop svg { width: 32px; height: 32px; color: " + textMuted + "; margin: 0 auto 8px; display: block; }\n\
      .td-file-drop p { font-size: 13px; color: " + textMuted + "; }\n\
      .td-file-drop .td-file-name { font-size: 13px; color: " + accent + "; font-weight: 600; }\n\
      .td-btn {\n\
        width: 100%; padding: 12px; border: none; border-radius: 8px;\n\
        background: " + accent + "; color: #fff;\n\
        font-size: 14px; font-weight: 600; cursor: pointer;\n\
        transition: opacity 0.15s; font-family: inherit;\n\
        display: flex; align-items: center; justify-content: center; gap: 8px;\n\
      }\n\
      .td-btn:hover { opacity: 0.9; }\n\
      .td-btn:disabled { opacity: 0.5; cursor: not-allowed; }\n\
      .td-btn svg { width: 16px; height: 16px; }\n\
      .td-result { text-align: center; }\n\
      .td-result svg { width: 48px; height: 48px; color: " + accent + "; margin: 0 auto 12px; display: block; }\n\
      .td-result h3 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }\n\
      .td-result p { font-size: 13px; color: " + textMuted + "; margin-bottom: 16px; }\n\
      .td-link-box {\n\
        display: flex; align-items: center; gap: 8px;\n\
        padding: 10px 12px; border-radius: 8px;\n\
        background: " + inputBg + "; border: 1px solid " + border + ";\n\
        margin-bottom: 12px;\n\
      }\n\
      .td-link-box input {\n\
        flex: 1; border: none; background: transparent; color: " + text + ";\n\
        font-size: 12px; font-family: monospace; outline: none; min-width: 0;\n\
      }\n\
      .td-copy-btn {\n\
        flex-shrink: 0; padding: 6px 12px; border: none; border-radius: 6px;\n\
        background: " + accent + "; color: #fff;\n\
        font-size: 12px; font-weight: 600; cursor: pointer;\n\
        font-family: inherit;\n\
      }\n\
      .td-copy-btn:hover { opacity: 0.9; }\n\
      .td-another {\n\
        background: transparent; border: 1px solid " + border + ";\n\
        color: " + textMuted + "; padding: 10px; border-radius: 8px;\n\
        width: 100%; font-size: 13px; cursor: pointer; font-family: inherit;\n\
      }\n\
      .td-another:hover { color: " + text + "; border-color: " + accent + "; }\n\
      .td-footer {\n\
        text-align: center; padding: 12px 24px 16px;\n\
        border-top: 1px solid " + border + ";\n\
      }\n\
      .td-footer a {\n\
        font-size: 11px; color: " + textMuted + "; text-decoration: none;\n\
      }\n\
      .td-footer a:hover { color: " + accent + "; }\n\
      .td-error {\n\
        background: rgba(239,68,68,0.1); color: #ef4444;\n\
        padding: 10px 12px; border-radius: 8px;\n\
        font-size: 13px; margin-bottom: 14px;\n\
      }\n\
      .td-spinner {\n\
        width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3);\n\
        border-top-color: #fff; border-radius: 50%;\n\
        animation: td-spin 0.6s linear infinite;\n\
      }\n\
      @keyframes td-spin { to { transform: rotate(360deg); } }\n\
    ";
  }

  /* =========================================================================
   * Inline SVG Icons (Lucide icon set)
   *
   * Embedded directly to avoid external dependencies. Each icon is a string
   * of SVG markup that gets injected via innerHTML.
   * ========================================================================= */
  var ICON_LOCK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
  var ICON_X = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  var ICON_UPLOAD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
  var ICON_CHECK_CIRCLE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
  var ICON_SHIELD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>';

  /* =========================================================================
   * TrustDropWidget Constructor
   *
   * Initializes the widget on a given container element. Reads configuration
   * from data attributes, sets up initial state, and attaches a Shadow DOM
   * for complete style isolation from the host page.
   * ========================================================================= */
  function TrustDropWidget(container) {
    var self = this;
    self.container = container;

    // Read configuration from data attributes on the container element
    self.config = {
      buttonText: container.getAttribute("data-button-text") || "Share a Secret",
      theme: container.getAttribute("data-theme") || "dark",
      accentColor: container.getAttribute("data-accent-color") || "#2a7d6e",
      origin: container.getAttribute("data-origin") || TRUSTDROP_ORIGIN
    };

    // Initial widget state — drives all rendering decisions
    self.state = {
      open: false,           // Whether the modal is visible
      tab: "message",        // Active tab: "message" or "file"
      message: "",           // Text content to encrypt
      file: null,            // File object to encrypt
      password: "",          // Optional password for Mode B encryption
      expiresIn: "86400",    // Expiry duration in seconds (default: 1 day)
      maxViews: "1",         // Maximum number of views before auto-destruction
      burnOnFail: true,      // Destroy secret on wrong password attempt
      creating: false,       // Loading state during encryption/upload
      error: null,           // Error message to display
      resultUrl: null,       // Generated one-time link after successful creation
      copied: false          // Whether the link has been copied to clipboard
    };

    // Attach Shadow DOM for style isolation — host page CSS cannot affect the widget
    self.shadow = container.attachShadow({ mode: "open" });
    self.render();
  }

  /* =========================================================================
   * Render Method
   *
   * Uses a render-from-scratch pattern: clears the entire Shadow DOM and
   * rebuilds it from the current state. This is simple and reliable — no
   * diffing or patching needed. Event listeners are re-attached on each render
   * since the DOM nodes are completely replaced.
   * ========================================================================= */
  TrustDropWidget.prototype.render = function() {
    var self = this;
    var s = self.state;
    var c = self.config;

    // Inject scoped styles into Shadow DOM
    var style = document.createElement("style");
    style.textContent = getStyles(c);

    var root = document.createElement("div");

    if (!s.open) {
      // Closed state: show only the trigger button
      root.innerHTML = '<button class="td-trigger" data-testid="button-trustdrop-widget">' + ICON_LOCK + ' ' + escapeHtml(c.buttonText) + '</button>';
      root.querySelector(".td-trigger").addEventListener("click", function() {
        self.state.open = true;
        self.render();
      });
    } else {
      // Open state: build and attach the full modal
      root.innerHTML = self.buildModal();
      self.attachModalEvents(root);
    }

    // Clear and rebuild the entire Shadow DOM
    self.shadow.innerHTML = "";
    self.shadow.appendChild(style);
    self.shadow.appendChild(root);
  };

  /* =========================================================================
   * Modal Builder — Form State
   *
   * Constructs the modal HTML for the creation form. Layout includes:
   *   - Tab switcher (Message / File)
   *   - Content area (textarea for messages, drop zone for files)
   *   - Password field (optional, enables Mode B encryption)
   *   - Expiry duration and max views selectors
   *   - Burn-on-fail checkbox (destroy secret on wrong password)
   *   - Submit button with loading spinner
   *
   * If state.resultUrl is set, delegates to buildResultModal() instead.
   * ========================================================================= */
  TrustDropWidget.prototype.buildModal = function() {
    var s = this.state;

    // If a link was already created, show the result view
    if (s.resultUrl) {
      return this.buildResultModal();
    }

    var tabMsg = s.tab === "message" ? "active" : "";
    var tabFile = s.tab === "file" ? "active" : "";

    // Build tab content based on active tab
    var content = "";
    if (s.tab === "message") {
      content = '<div class="td-field">\
        <label class="td-label">Secret Message</label>\
        <textarea class="td-textarea" placeholder="Paste your secret here..." data-testid="input-widget-message">' + escapeHtml(s.message) + '</textarea>\
      </div>';
    } else {
      // File tab: show selected file info or empty drop zone
      if (s.file) {
        content = '<div class="td-file-drop" data-testid="button-widget-file-area">\
          ' + ICON_UPLOAD + '\
          <p class="td-file-name">' + escapeHtml(s.file.name) + '</p>\
          <p>' + formatSize(s.file.size) + ' - Click to change</p>\
        </div>';
      } else {
        content = '<div class="td-file-drop" data-testid="button-widget-file-area">\
          ' + ICON_UPLOAD + '\
          <p>Click to select a file</p>\
          <p>Max 50 MB</p>\
        </div>';
      }
      content += '<input type="file" style="display:none" data-testid="input-widget-file">';
    }

    var errorHtml = s.error ? '<div class="td-error">' + escapeHtml(s.error) + '</div>' : '';

    return '<div class="td-overlay visible">\
      <div class="td-modal">\
        <div class="td-header">\
          <div class="td-header-left">' + ICON_SHIELD + '<h2>TrustDrop</h2></div>\
          <button class="td-close" data-testid="button-widget-close">' + ICON_X + '</button>\
        </div>\
        <div class="td-body">\
          <div class="td-tabs">\
            <button class="td-tab ' + tabMsg + '" data-tab="message" data-testid="tab-widget-message">Message</button>\
            <button class="td-tab ' + tabFile + '" data-tab="file" data-testid="tab-widget-file">File</button>\
          </div>\
          ' + content + '\
          <div class="td-field">\
            <label class="td-label">Password (optional)</label>\
            <input type="password" class="td-input" placeholder="Add a password for extra security" value="' + escapeAttr(s.password) + '" data-testid="input-widget-password">\
          </div>\
          <div class="td-row">\
            <div class="td-field">\
              <label class="td-label">Expires</label>\
              <select class="td-select" data-field="expiresIn" data-testid="select-widget-expires">\
                <option value="3600"' + (s.expiresIn === "3600" ? " selected" : "") + '>1 hour</option>\
                <option value="86400"' + (s.expiresIn === "86400" ? " selected" : "") + '>1 day</option>\
                <option value="604800"' + (s.expiresIn === "604800" ? " selected" : "") + '>7 days</option>\
                <option value="2592000"' + (s.expiresIn === "2592000" ? " selected" : "") + '>30 days</option>\
              </select>\
            </div>\
            <div class="td-field">\
              <label class="td-label">Max Views</label>\
              <select class="td-select" data-field="maxViews" data-testid="select-widget-views">\
                <option value="1"' + (s.maxViews === "1" ? " selected" : "") + '>1 view</option>\
                <option value="3"' + (s.maxViews === "3" ? " selected" : "") + '>3 views</option>\
                <option value="5"' + (s.maxViews === "5" ? " selected" : "") + '>5 views</option>\
                <option value="10"' + (s.maxViews === "10" ? " selected" : "") + '>10 views</option>\
              </select>\
            </div>\
          </div>\
          <div class="td-checkbox-row">\
            <input type="checkbox" class="td-checkbox"' + (s.burnOnFail ? " checked" : "") + ' id="td-burn" data-testid="input-widget-burn">\
            <label class="td-checkbox-label" for="td-burn">Destroy on wrong password</label>\
          </div>\
          ' + errorHtml + '\
          <button class="td-btn" ' + (s.creating ? "disabled" : "") + ' data-testid="button-widget-create">\
            ' + (s.creating ? '<div class="td-spinner"></div> Encrypting...' : ICON_LOCK + ' Create Secure Link') + '\
          </button>\
        </div>\
        <div class="td-footer"><a href="' + this.config.origin + '" target="_blank" rel="noopener">Secured by TrustDrop</a></div>\
      </div>\
    </div>';
  };

  /* =========================================================================
   * Modal Builder — Result State
   *
   * Displays the generated one-time link after a successful drop creation.
   * Shows a read-only input with the link, a copy button, and an option
   * to create another drop.
   * ========================================================================= */
  TrustDropWidget.prototype.buildResultModal = function() {
    var s = this.state;
    return '<div class="td-overlay visible">\
      <div class="td-modal">\
        <div class="td-header">\
          <div class="td-header-left">' + ICON_SHIELD + '<h2>TrustDrop</h2></div>\
          <button class="td-close" data-testid="button-widget-close">' + ICON_X + '</button>\
        </div>\
        <div class="td-body">\
          <div class="td-result">\
            ' + ICON_CHECK_CIRCLE + '\
            <h3>Secret Link Created</h3>\
            <p>Share this link with the recipient. It will self-destruct after viewing.</p>\
          </div>\
          <div class="td-link-box">\
            <input type="text" value="' + escapeAttr(s.resultUrl) + '" readonly data-testid="input-widget-link">\
            <button class="td-copy-btn" data-testid="button-widget-copy">' + (s.copied ? "Copied!" : "Copy") + '</button>\
          </div>\
          <button class="td-another" data-testid="button-widget-another">Create Another</button>\
        </div>\
        <div class="td-footer"><a href="' + this.config.origin + '" target="_blank" rel="noopener">Secured by TrustDrop</a></div>\
      </div>\
    </div>';
  };

  /* =========================================================================
   * Event Binding
   *
   * Attaches all event listeners to the modal DOM. Called on every render
   * because the render-from-scratch pattern replaces all DOM nodes, so
   * previous listeners are discarded along with the old DOM.
   * ========================================================================= */
  TrustDropWidget.prototype.attachModalEvents = function(root) {
    var self = this;
    var s = self.state;

    // Close button dismisses the modal
    root.querySelector(".td-close").addEventListener("click", function() {
      self.close();
    });

    // Clicking the overlay backdrop also closes the modal
    var overlay = root.querySelector(".td-overlay");
    overlay.addEventListener("click", function(e) {
      if (e.target === overlay) self.close();
    });

    // Result view: copy link and "create another" handlers
    if (s.resultUrl) {
      var copyBtn = root.querySelector(".td-copy-btn");
      copyBtn.addEventListener("click", function() {
        var input = root.querySelector('.td-link-box input');
        input.select();
        navigator.clipboard.writeText(s.resultUrl).then(function() {
          self.state.copied = true;
          copyBtn.textContent = "Copied!";
          setTimeout(function() {
            self.state.copied = false;
            copyBtn.textContent = "Copy";
          }, 2000);
        });
      });

      root.querySelector(".td-another").addEventListener("click", function() {
        self.reset();
        self.render();
      });
      return;
    }

    // Tab switching between Message and File modes
    var tabs = root.querySelectorAll(".td-tab");
    tabs.forEach(function(tab) {
      tab.addEventListener("click", function() {
        self.state.tab = tab.getAttribute("data-tab");
        self.render();
      });
    });

    // Message tab: sync textarea value to state
    if (s.tab === "message") {
      var textarea = root.querySelector(".td-textarea");
      textarea.addEventListener("input", function() {
        self.state.message = textarea.value;
      });
    } else {
      // File tab: click-to-browse and file size validation (50 MB limit)
      var fileArea = root.querySelector(".td-file-drop");
      var fileInput = root.querySelector('input[type="file"]');
      fileArea.addEventListener("click", function() { fileInput.click(); });
      fileInput.addEventListener("change", function() {
        if (fileInput.files && fileInput.files[0]) {
          var f = fileInput.files[0];
          if (f.size > 50 * 1024 * 1024) {
            self.state.error = "File is too large. Maximum size is 50 MB.";
            self.render();
            return;
          }
          self.state.file = f;
          self.state.error = null;
          self.render();
        }
      });
    }

    // Password input: sync to state for Mode B encryption
    var passwordInput = root.querySelector('input[type="password"]');
    passwordInput.addEventListener("input", function() {
      self.state.password = passwordInput.value;
    });

    // Select fields (expiry, max views): update state via data-field attribute
    root.querySelectorAll(".td-select").forEach(function(sel) {
      sel.addEventListener("change", function() {
        self.state[sel.getAttribute("data-field")] = sel.value;
      });
    });

    // Burn-on-fail checkbox: destroy secret if wrong password is entered
    var burnCheckbox = root.querySelector(".td-checkbox");
    burnCheckbox.addEventListener("change", function() {
      self.state.burnOnFail = burnCheckbox.checked;
    });

    // Submit button: triggers the full encrypt-and-upload flow
    root.querySelector(".td-btn").addEventListener("click", function() {
      self.createDrop();
    });
  };

  // Closes the modal and re-renders to the trigger button state
  TrustDropWidget.prototype.close = function() {
    this.state.open = false;
    this.render();
  };

  // Resets all form state to defaults for creating a new drop
  TrustDropWidget.prototype.reset = function() {
    this.state.tab = "message";
    this.state.message = "";
    this.state.file = null;
    this.state.password = "";
    this.state.expiresIn = "86400";
    this.state.maxViews = "1";
    this.state.burnOnFail = true;
    this.state.creating = false;
    this.state.error = null;
    this.state.resultUrl = null;
    this.state.copied = false;
  };

  /* =========================================================================
   * Core Flow: Create Drop
   *
   * Orchestrates the full secret-creation pipeline:
   *   1. Validate input (message text or file selection)
   *   2. Encrypt client-side using AES-256-GCM (plaintext never leaves the browser)
   *   3. POST encrypted payload to /api/drops on the TrustDrop server
   *   4. Construct the one-time link for the recipient
   *
   * URL structure: {origin}/d/{id}?t={accessToken}#k={encryptionKey}
   *   - {id}: server-generated drop identifier
   *   - ?t={accessToken}: bearer token for retrieving the ciphertext
   *   - #k={encryptionKey}: Mode A only — the AES key in the URL fragment
   *
   * Security: The URL fragment (#k=...) is never sent to the server per the
   * HTTP specification. In Mode B (password), the fragment is omitted entirely.
   * ========================================================================= */
  TrustDropWidget.prototype.createDrop = async function() {
    var self = this;
    var s = self.state;

    // Validate that content exists before proceeding
    if (s.tab === "message" && !s.message.trim()) {
      s.error = "Please enter a message.";
      self.render();
      return;
    }
    if (s.tab === "file" && !s.file) {
      s.error = "Please select a file.";
      self.render();
      return;
    }

    s.creating = true;
    s.error = null;
    self.render();

    try {
      // Step 1: Encrypt content client-side (Mode A or Mode B based on password)
      var result;
      if (s.tab === "message") {
        result = await encryptMessage(s.message, s.password || undefined);
      } else {
        var fileData = await s.file.arrayBuffer();
        result = await encryptFile(fileData, s.password || undefined);
      }

      // Step 2: Build metadata (IV, salt, content type, file info)
      var meta = {
        iv: result.iv,
        salt: result.salt,
        hasPassword: !!s.password,
        type: s.tab === "message" ? "text" : "file"
      };

      if (s.tab === "file" && s.file) {
        meta.mime = s.file.type || "application/octet-stream";
        meta.filename = s.file.name;
        meta.size = s.file.size;
      }

      // Step 3: POST ciphertext and metadata to the TrustDrop API
      var response = await fetch(self.config.origin + "/api/drops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ciphertext_b64: result.ciphertext_b64,
          meta: meta,
          expires_in_seconds: parseInt(s.expiresIn),
          max_views: parseInt(s.maxViews),
          burn_on_fail: s.burnOnFail
        })
      });

      if (!response.ok) {
        var err = await response.json().catch(function() { return {}; });
        throw new Error(err.message || "Failed to create drop");
      }

      // Step 4: Construct the one-time link
      // Format: {origin}/d/{id}?t={accessToken}#k={encryptionKey}
      var data = await response.json();
      var url = self.config.origin + "/d/" + data.id + "?t=" + data.accessToken;
      if (result.keyBase64url) {
        // Mode A only: append the encryption key in the URL fragment
        // The fragment (#k=...) is never sent to the server
        url += "#k=" + result.keyBase64url;
      }

      s.resultUrl = url;
      s.creating = false;
      self.render();
    } catch(err) {
      s.error = err.message || "Something went wrong. Please try again.";
      s.creating = false;
      self.render();
    }
  };

  /* =========================================================================
   * Utility Functions
   * ========================================================================= */

  // XSS prevention: safely escapes user input for use in innerHTML contexts.
  // Leverages the browser's own text node encoding via textContent -> innerHTML.
  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // XSS prevention: escapes user input for safe insertion into HTML attribute values.
  // Replaces characters that could break out of attribute quotes.
  function escapeAttr(str) {
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Formats byte counts into human-readable file sizes (B, KB, MB).
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  /* =========================================================================
   * Auto-Initialization
   *
   * Automatically discovers and initializes widget containers on page load.
   * Containers are found by ID (#trustdrop-widget) or data attribute
   * ([data-trustdrop-widget]). Each container is initialized only once
   * (guarded by the _trustdropWidget flag).
   * ========================================================================= */
  function init() {
    var containers = document.querySelectorAll("#trustdrop-widget, [data-trustdrop-widget]");
    containers.forEach(function(el) {
      if (!el._trustdropWidget) {
        el._trustdropWidget = new TrustDropWidget(el);
      }
    });
  }

  // Initialize when DOM is ready, or immediately if already loaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Export constructor globally for programmatic usage:
  //   var widget = new TrustDropWidget(document.getElementById("my-container"));
  if (typeof window !== "undefined") {
    window.TrustDropWidget = TrustDropWidget;
  }
})();
