/**
 * TrustDrop Client-Side Encryption Module
 * 
 * Implements zero-knowledge secret sharing with two encryption modes:
 * 
 * Mode A (No Password - URL Fragment Mode):
 * - Generates a random 256-bit AES-GCM key via WebCrypto
 * - Key is exported to base64url encoding and placed in the URL fragment (#k=...)
 * - The URL fragment is never sent to the server per HTTP specification
 * - Server stores only ciphertext + IV; cannot decrypt without the fragment key
 * - Optimal for: Public URLs where sharing the full link grants access
 * 
 * Mode B (Password Mode):
 * - Derives an AES-256-GCM key from the user's password using PBKDF2
 * - Uses 310,000 iterations with SHA-256 (OWASP 2023 recommendation)
 * - Combines password with a random 16-byte salt for key derivation
 * - No key in the URL; recipient must know the password separately
 * - Server stores ciphertext + IV + salt (salt can be public); cannot decrypt without password
 * - Optimal for: Passwords shared via secure channel (not in the link)
 * 
 * Both modes use AES-GCM for authenticated encryption (confidentiality + integrity).
 * The 12-byte random IV ensures semantic security (same plaintext encrypts differently).
 */

// Base64 utility functions for encoding/decoding cryptographic material

/**
 * Converts an ArrayBuffer to standard base64 encoding.
 * Used internally before base64url conversion.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts standard base64 to an ArrayBuffer.
 * Used internally after base64url conversion.
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Converts an ArrayBuffer to base64url encoding (RFC 4648).
 * Base64url replaces standard base64's URL-unsafe characters:
 * - '+' → '-' (plus to minus)
 * - '/' → '_' (slash to underscore)
 * - Removes '=' padding
 * This encoding is safe for URL fragments and query parameters,
 * ensuring the encryption key can be placed directly in #k=... without encoding issues.
 */
function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  return arrayBufferToBase64(buffer)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Converts a base64url string back to an ArrayBuffer.
 * Reverses the base64url transformation to recover the original binary data.
 */
function base64urlToArrayBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return base64ToArrayBuffer(base64);
}

/**
 * Generates a random 256-bit AES-GCM key via WebCrypto.
 * The key is extractable (extractable: true), allowing it to be exported
 * to base64url format and placed in the URL fragment for Mode A encryption.
 * 
 * @returns A CryptoKey suitable for AES-GCM encryption/decryption
 */
export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // extractable: key can be exported for URL fragment
    ["encrypt", "decrypt"]
  );
}

/**
 * Exports a CryptoKey to a base64url-encoded string.
 * Used in Mode A to prepare the random key for URL fragment placement (#k=...).
 * 
 * @param key The CryptoKey to export (must be extractable)
 * @returns Base64url-encoded key suitable for URL fragment
 */
export async function exportKeyToBase64url(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return arrayBufferToBase64url(raw);
}

/**
 * Imports a base64url-encoded key string into a CryptoKey.
 * Used in Mode A to reconstruct the encryption key from the URL fragment.
 * The key is non-extractable (extractable: false) after import for security.
 * 
 * @param base64url The base64url-encoded key string from the URL fragment
 * @returns A CryptoKey for decryption only (decrypt capability)
 */
export async function importKeyFromBase64url(
  base64url: string
): Promise<CryptoKey> {
  const raw = base64urlToArrayBuffer(base64url);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
    "decrypt",
  ]);
}

/**
 * Derives an AES-256-GCM key from a password using PBKDF2-SHA256.
 * Used in Mode B for password-based encryption.
 * 
 * Security parameters:
 * - Iterations: 310,000 (OWASP 2023 recommendation for SHA-256)
 *   High iteration count makes brute-force attacks computationally expensive
 * - Hash: SHA-256 (cryptographically secure)
 * - Output: 256-bit AES-GCM key
 * - Extractable: false (derived key cannot be exported, only used for encrypt/decrypt)
 *   This prevents accidental key exposure; the password remains the only way to recreate it
 * 
 * @param password The user's password
 * @param salt A random 16-byte salt (should be unique per secret)
 * @returns A non-extractable CryptoKey derived from the password and salt
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: ArrayBuffer
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false, // non-extractable: derived key cannot be exported
    ["encrypt", "decrypt"]
  );
}

/**
 * Core encryption function using AES-GCM.
 * 
 * Security details:
 * - Generates a random 12-byte IV for each encryption (standard for AES-GCM)
 * - AES-GCM provides authenticated encryption: both confidentiality (secrecy)
 *   and authenticity/integrity (tamper detection in one operation)
 * - Unique IV per message ensures semantic security (identical plaintext
 *   encrypts differently each time, preventing pattern analysis)
 * 
 * @param data The plaintext to encrypt
 * @param key The encryption key (from Mode A or Mode B)
 * @returns Ciphertext and IV (base64-encoded for JSON/URL compatibility)
 */
async function encryptData(
  data: ArrayBuffer,
  key: CryptoKey
): Promise<{ ciphertext: ArrayBuffer; iv: string }> {
  // Generate random 12-byte IV (96-bit is standard for GCM mode)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  return { ciphertext, iv: arrayBufferToBase64(iv.buffer) };
}

/**
 * Core decryption function for AES-GCM.
 * Reverses the encryptData operation using the same key and IV.
 * AES-GCM will verify the authentication tag and throw if tampered.
 * 
 * @param ciphertext The encrypted data
 * @param key The decryption key (reconstructed from URL fragment or password)
 * @param ivBase64 The base64-encoded IV used during encryption
 * @returns The decrypted plaintext
 */
async function decryptData(
  ciphertext: ArrayBuffer,
  key: CryptoKey,
  ivBase64: string
): Promise<ArrayBuffer> {
  const iv = base64ToArrayBuffer(ivBase64);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
}

/**
 * Encrypts a text message using either Mode A or Mode B.
 * 
 * Mode A (no password):
 * - Generates a random 256-bit AES-GCM key
 * - Returns keyBase64url (to be placed in URL fragment #k=...)
 * - salt is undefined
 * 
 * Mode B (password provided):
 * - Generates a random 16-byte salt
 * - Derives key from password + salt using PBKDF2
 * - Returns salt (can be public; stored/transmitted with ciphertext)
 * - keyBase64url is undefined (key is not recoverable without password)
 * 
 * @param message The plaintext message to encrypt
 * @param password Optional password for Mode B; omit for Mode A (URL fragment mode)
 * @returns Encrypted message data with ciphertext, IV, and (salt or keyBase64url)
 */
export async function encryptMessage(
  message: string,
  password?: string
): Promise<{
  ciphertext_b64: string;
  iv: string;
  salt?: string;
  keyBase64url?: string;
}> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  let key: CryptoKey;
  let salt: ArrayBuffer | undefined;
  let keyBase64url: string | undefined;

  if (password) {
    // Mode B: Password-based key derivation
    salt = crypto.getRandomValues(new Uint8Array(16)).buffer;
    key = await deriveKeyFromPassword(password, salt);
  } else {
    // Mode A: Random key for URL fragment
    key = await generateKey();
    keyBase64url = await exportKeyToBase64url(key);
  }

  const { ciphertext, iv } = await encryptData(data, key);

  return {
    ciphertext_b64: arrayBufferToBase64(ciphertext),
    iv,
    salt: salt ? arrayBufferToBase64(salt) : undefined,
    keyBase64url,
  };
}

/**
 * Encrypts a file (binary data) using either Mode A or Mode B.
 * Identical logic to encryptMessage, but for arbitrary ArrayBuffer data.
 * 
 * Mode A (no password):
 * - Generates a random 256-bit AES-GCM key
 * - Returns keyBase64url (to be placed in URL fragment #k=...)
 * - salt is undefined
 * 
 * Mode B (password provided):
 * - Generates a random 16-byte salt
 * - Derives key from password + salt using PBKDF2
 * - Returns salt (can be public; stored/transmitted with ciphertext)
 * - keyBase64url is undefined (key is not recoverable without password)
 * 
 * @param fileData The binary file data to encrypt
 * @param password Optional password for Mode B; omit for Mode A (URL fragment mode)
 * @returns Encrypted file data with ciphertext, IV, and (salt or keyBase64url)
 */
export async function encryptFile(
  fileData: ArrayBuffer,
  password?: string
): Promise<{
  ciphertext_b64: string;
  iv: string;
  salt?: string;
  keyBase64url?: string;
}> {
  let key: CryptoKey;
  let salt: ArrayBuffer | undefined;
  let keyBase64url: string | undefined;

  if (password) {
    // Mode B: Password-based key derivation
    salt = crypto.getRandomValues(new Uint8Array(16)).buffer;
    key = await deriveKeyFromPassword(password, salt);
  } else {
    // Mode A: Random key for URL fragment
    key = await generateKey();
    keyBase64url = await exportKeyToBase64url(key);
  }

  const { ciphertext, iv } = await encryptData(fileData, key);

  return {
    ciphertext_b64: arrayBufferToBase64(ciphertext),
    iv,
    salt: salt ? arrayBufferToBase64(salt) : undefined,
    keyBase64url,
  };
}

/**
 * Decrypts a text message using either Mode A or Mode B.
 * Reconstructs the encryption key from either:
 * - Mode A: keyBase64url from URL fragment (#k=...)
 * - Mode B: password + salt (salt is decoded from base64)
 * 
 * @param ciphertext_b64 The base64-encoded ciphertext
 * @param iv The base64-encoded initialization vector
 * @param keyBase64url Optional key from URL fragment (Mode A)
 * @param password Optional password for key derivation (Mode B)
 * @param salt Optional base64-encoded salt used during encryption (Mode B)
 * @returns The decrypted plaintext message
 * @throws Error if neither (keyBase64url) nor (password+salt) are provided
 */
export async function decryptMessage(
  ciphertext_b64: string,
  iv: string,
  keyBase64url?: string,
  password?: string,
  salt?: string
): Promise<string> {
  const ciphertext = base64ToArrayBuffer(ciphertext_b64);

  let key: CryptoKey;
  if (password && salt) {
    // Mode B: Reconstruct key from password and salt
    const saltBuffer = base64ToArrayBuffer(salt);
    key = await deriveKeyFromPassword(password, saltBuffer);
  } else if (keyBase64url) {
    // Mode A: Import key from URL fragment
    key = await importKeyFromBase64url(keyBase64url);
  } else {
    throw new Error("Either password+salt or keyBase64url must be provided");
  }

  const decrypted = await decryptData(ciphertext, key, iv);
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Decrypts binary file data using either Mode A or Mode B.
 * Identical logic to decryptMessage, but returns raw ArrayBuffer instead of text.
 * Reconstructs the encryption key from either:
 * - Mode A: keyBase64url from URL fragment (#k=...)
 * - Mode B: password + salt (salt is decoded from base64)
 * 
 * @param ciphertext_b64 The base64-encoded ciphertext
 * @param iv The base64-encoded initialization vector
 * @param keyBase64url Optional key from URL fragment (Mode A)
 * @param password Optional password for key derivation (Mode B)
 * @param salt Optional base64-encoded salt used during encryption (Mode B)
 * @returns The decrypted binary data as an ArrayBuffer
 * @throws Error if neither (keyBase64url) nor (password+salt) are provided
 */
export async function decryptToBuffer(
  ciphertext_b64: string,
  iv: string,
  keyBase64url?: string,
  password?: string,
  salt?: string
): Promise<ArrayBuffer> {
  const ciphertext = base64ToArrayBuffer(ciphertext_b64);

  let key: CryptoKey;
  if (password && salt) {
    // Mode B: Reconstruct key from password and salt
    const saltBuffer = base64ToArrayBuffer(salt);
    key = await deriveKeyFromPassword(password, saltBuffer);
  } else if (keyBase64url) {
    // Mode A: Import key from URL fragment
    key = await importKeyFromBase64url(keyBase64url);
  } else {
    throw new Error("Either password+salt or keyBase64url must be provided");
  }

  return decryptData(ciphertext, key, iv);
}
