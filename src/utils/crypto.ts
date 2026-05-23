/**
 * Chat encryption utilities using Web Crypto API.
 * AES-GCM authenticated encryption, key derived from the user's chatEncKey
 * (issued on login, kept in Redux + sessionStorage).
 *
 * Ported verbatim from plurality-memory-studio so chat threads encrypted in
 * either app share the same wire format. Threads still live per-origin in
 * IndexedDB, so cross-app thread visibility is a separate concern.
 */

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const importKey = async (base64Key: string): Promise<CryptoKey> => {
  const keyBuffer = base64ToArrayBuffer(base64Key);
  return crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
};

/**
 * Encrypt arbitrary JSON-serialisable data. Returns base64(iv + ciphertext).
 */
export const encryptData = async <T>(data: T, base64Key: string): Promise<string> => {
  try {
    const key = await importKey(base64Key);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
    const plaintext = new TextEncoder().encode(JSON.stringify(data));

    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return arrayBufferToBase64(combined.buffer);
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt the inverse of encryptData. Throws on tampered data (GCM auth fail).
 */
export const decryptData = async <T>(encryptedBase64: string, base64Key: string): Promise<T> => {
  try {
    const key = await importKey(base64Key);
    const combined = new Uint8Array(base64ToArrayBuffer(encryptedBase64));

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);

    const decoded = new TextDecoder().decode(plaintext);
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Heuristic — is this string plausibly an encryptData() output?
 * Used to migrate legacy plaintext threads on the fly.
 */
export const isEncrypted = (data: string): boolean => {
  try {
    const decoded = atob(data);
    return decoded.length > 12;
  } catch {
    return false;
  }
};
