/**
 * Server-side AES-256-GCM decryption for WooCommerce credentials.
 *
 * This is the exact inverse of the frontend encryptCredential() function
 * (packages/frontend/src/lib/crypto.ts), using Node's built-in 'node:crypto'
 * module instead of the Web Crypto API.
 *
 * Expected blob format: "<ivHex>:<ciphertextHex>"
 * Key: 64-character hex string (32 bytes / 256 bits)
 *
 * The decryption key (VITE_ENCRYPTION_KEY) is shared with the frontend
 * but must NEVER be logged, stored in PocketBase, or exposed in responses.
 */

import { createDecipheriv } from 'node:crypto'

function hexToBuffer(hex: string): Buffer {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string')
  return Buffer.from(hex, 'hex')
}

/**
 * Decrypt an AES-256-GCM blob produced by the frontend encryptCredential().
 *
 * @param blob    "<ivHex>:<ciphertextHex>" — the value stored in userPreferences.encryptedWoocommerceKey
 * @param keyHex  64-character hex string from VITE_ENCRYPTION_KEY env var
 * @returns       Original plaintext (e.g. "ck_abc123:cs_xyz789")
 * @throws        Error if key is wrong length, blob is malformed, or authentication tag fails (tampered data)
 */
export function decryptWoocommerceKey(blob: string, keyHex: string): string {
  const colonIdx = blob.indexOf(':')
  if (colonIdx === -1) {
    throw new Error('Invalid encrypted blob format — expected "<ivHex>:<ciphertextHex>"')
  }

  const keyBuf = hexToBuffer(keyHex)
  if (keyBuf.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (256 bits) — provide a 64-character hex string')
  }

  const ivBuf = hexToBuffer(blob.slice(0, colonIdx))
  // AES-256-GCM appends a 16-byte auth tag at the end of ciphertext
  const fullCipher = hexToBuffer(blob.slice(colonIdx + 1))

  if (fullCipher.length < 17) {
    throw new Error('Ciphertext too short — blob may be truncated or corrupted')
  }

  const authTag = fullCipher.subarray(fullCipher.length - 16)
  const ciphertext = fullCipher.subarray(0, fullCipher.length - 16)

  const decipher = createDecipheriv('aes-256-gcm', keyBuf, ivBuf)
  decipher.setAuthTag(authTag)

  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plain.toString('utf-8')
}
