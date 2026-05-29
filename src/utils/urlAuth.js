/**
 * urlAuth.js — Secure URL parameter-based login helper
 *
 * Flow:
 *  Mobile app encrypts { email, password, ts } with a shared AES-256-GCM key
 *  and appends it to the launch URL:
 *    http://localhost:3000/Audit-App-React?auth=<BASE64URL_PAYLOAD>
 *
 * Payload format (Base64url-encoded, dot-separated):
 *   <iv_base64url>.<ciphertext_base64url>
 *   where iv  = 12 random bytes
 *         ciphertext = AES-GCM encrypted JSON: { email, password, ts }
 *
 * Security properties:
 *  ✅ AES-256-GCM — authenticated encryption (integrity + confidentiality)
 *  ✅ Random IV per token — no two tokens are identical even for same credentials
 *  ✅ Timestamp check — tokens expire after TOKEN_TTL_MS (default 5 minutes)
 *  ✅ URL is stripped immediately after reading — never saved in browser history
 *  ✅ Key lives in .env — not hardcoded in source
 *  ✅ node-forge fallback — works in Android WebView over HTTP (no secure context needed)
 *
 * Shared secret format (REACT_APP_URL_AUTH_SECRET):
 *  A 64-character hex string representing 32 bytes (256 bits).
 *  Example: "a3f1...64 hex chars..."
 *  Both the mobile app and this React app MUST use the same key.
 */

import forge from 'node-forge';

const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes — tokens older than this are rejected

// ── Helpers ──────────────────────────────────────────────────────────────────

function base64urlToBytes(b64url) {
  // Convert Base64url → standard Base64 → Uint8Array
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  
  // Pad with '=' if the length is not a multiple of 4 (strict atob requirement on some mobile platforms)
  const pad = b64.length % 4;
  if (pad === 2) {
    b64 += '==';
  } else if (pad === 3) {
    b64 += '=';
  }

  const binary = atob(b64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function hexToBytes(hex) {
  if (hex.length !== 64) {
    throw new Error('REACT_APP_URL_AUTH_SECRET must be a 64-character hex string (32 bytes).');
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// ── Crypto backend ────────────────────────────────────────────────────────────

/**
 * Decrypt AES-256-GCM using the native Web Crypto API.
 * Only works in secure contexts (HTTPS or localhost).
 */
async function decryptWithWebCrypto(keyBytes, iv, ciphertextWithTag) {
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  const plainBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ciphertextWithTag
  );
  return new TextDecoder().decode(plainBuffer);
}

/**
 * Decrypt AES-256-GCM using node-forge (pure JS).
 * Works in ALL contexts including Android WebView over HTTP.
 *
 * NOTE: AES-GCM ciphertext from Java/Android has the 16-byte auth tag
 * appended at the END of the ciphertext buffer (same as Web Crypto).
 */
function decryptWithForge(keyBytes, iv, ciphertextWithTag) {
  // Convert Uint8Array → forge ByteStringBuffer
  const toForgeBuffer = (arr) => forge.util.createBuffer(String.fromCharCode(...arr));

  const keyBuf = toForgeBuffer(keyBytes);
  const ivBuf = toForgeBuffer(iv);

  // Last 16 bytes = GCM auth tag
  const tagBytes = ciphertextWithTag.slice(ciphertextWithTag.length - 16);
  const ctBytes  = ciphertextWithTag.slice(0, ciphertextWithTag.length - 16);

  const decipher = forge.cipher.createDecipher('AES-GCM', keyBuf.bytes());
  decipher.start({
    iv:  ivBuf.bytes(),
    tag: forge.util.createBuffer(String.fromCharCode(...tagBytes)),
  });
  decipher.update(forge.util.createBuffer(String.fromCharCode(...ctBytes)));

  const pass = decipher.finish();
  if (!pass) {
    throw new Error('Decryption failed — invalid or tampered token.');
  }

  return decipher.output.toString('utf8');
}

// ── Core decrypt function ─────────────────────────────────────────────────────

/**
 * Decrypt the `auth` URL parameter and return validated credentials.
 *
 * @param {string} encryptedParam  — The raw value of the `?auth=` query parameter
 * @param {string} secretHex       — 64-char hex key (from REACT_APP_URL_AUTH_SECRET)
 * @returns {Promise<{ email: string, password: string }>}
 * @throws if decryption fails, payload is malformed, or the token is expired
 */
export async function decryptAuthParam(encryptedParam, secretHex) {
  // 1. Split IV and ciphertext
  const parts = encryptedParam.split('.');
  if (parts.length !== 2) {
    throw new Error('Malformed auth parameter.');
  }
  const [ivB64, ctB64] = parts;

  // 2. Decode IV and ciphertext
  const keyBytes         = hexToBytes(secretHex);
  const iv               = base64urlToBytes(ivB64);
  const ciphertextWithTag = base64urlToBytes(ctB64);

  // 3. Decrypt — use Web Crypto API if available (secure context), else fall back to node-forge
  let plainText;
  const webCryptoAvailable = window.crypto && window.crypto.subtle;

  try {
    if (webCryptoAvailable) {
      console.log('[urlAuth] Using Web Crypto API for decryption.');
      plainText = await decryptWithWebCrypto(keyBytes, iv, ciphertextWithTag);
    } else {
      console.log('[urlAuth] Web Crypto API unavailable (insecure context). Using node-forge fallback.');
      plainText = decryptWithForge(keyBytes, iv, ciphertextWithTag);
    }
  } catch (err) {
    throw new Error('Decryption failed — invalid or tampered token.');
  }

  // 4. Parse JSON payload
  let payload;
  try {
    payload = JSON.parse(plainText);
  } catch {
    throw new Error('Decryption succeeded but payload is not valid JSON.');
  }

  const { email, password, ts } = payload;

  // 5. Validate required fields
  if (!email || !password || !ts) {
    throw new Error('Payload missing required fields (email, password, ts).');
  }

  // 6. Check timestamp — reject tokens older than TOKEN_TTL_MS
  const age = Date.now() - ts;
  if (age > TOKEN_TTL_MS || age < -30_000) {
    // age < -30s catches tokens with a clock skew greater than 30 seconds (tampered/future ts)
    throw new Error('Login link has expired. Please re-launch from the mobile app.');
  }

  return { email, password };
}
