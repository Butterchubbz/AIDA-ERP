/**
 * Web Crypto API utilities for encrypting/decrypting WooCommerce credentials.
 *
 * Algorithm: AES-256-GCM with a random 12-byte IV per encryption.
 * Encrypted format: "<ivHex>:<ciphertextHex>"
 *
 * The encryption key is a 32-byte (256-bit) value stored in VITE_ENCRYPTION_KEY
 * as a hex string (64 hex chars). It must NEVER be embedded in the bundle —
 * only load it from import.meta.env inside this module.
 *
 * Because the IV is randomly generated each call, encrypting the same plaintext
 * twice produces different ciphertext (semantic security).
 */

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string')
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function importAesKey(keyHex: string, usage: KeyUsage[]): Promise<CryptoKey> {
  const keyBytes = hexToBytes(keyHex)
  if (keyBytes.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (256 bits) — provide a 64-character hex string')
  }
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, usage)
}

/**
 * Encrypt plaintext using AES-256-GCM.
 *
 * @param plaintext  The string to encrypt (e.g. "consumer_key:consumer_secret")
 * @param keyHex     64-character hex string (32 bytes) from VITE_ENCRYPTION_KEY
 * @returns          "<ivHex>:<ciphertextHex>"
 */
export async function encryptCredential(plaintext: string, keyHex: string): Promise<string> {
  const key = await importAesKey(keyHex, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)

  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)

  return `${bytesToHex(iv)}:${bytesToHex(new Uint8Array(cipherBuf))}`
}

/**
 * Decrypt an encrypted blob produced by encryptCredential().
 *
 * @param blob    "<ivHex>:<ciphertextHex>"
 * @param keyHex  64-character hex string (32 bytes) from VITE_ENCRYPTION_KEY
 * @returns       Original plaintext string
 */
export async function decryptCredential(blob: string, keyHex: string): Promise<string> {
  const colonIdx = blob.indexOf(':')
  if (colonIdx === -1) throw new Error('Invalid encrypted blob format — expected "<ivHex>:<ciphertextHex>"')

  const ivHex = blob.slice(0, colonIdx)
  const ciphertextHex = blob.slice(colonIdx + 1)

  const key = await importAesKey(keyHex, ['decrypt'])
  const iv = hexToBytes(ivHex)
  const cipherBytes = hexToBytes(ciphertextHex)

  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes)

  return new TextDecoder().decode(plainBuf)
}
