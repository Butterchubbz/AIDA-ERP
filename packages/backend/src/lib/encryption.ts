import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16

function getKey(): Buffer {
  const keyHex = process.env.AIDA_ENCRYPTION_KEY
  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error('AIDA_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Run the setup wizard to generate one.')
  }
  return Buffer.from(keyHex, 'hex')
}

/**
 * Encrypt a plaintext string with AES-256-GCM using the server-side key.
 * Output format: "<ivHex>:<authTagHex>:<ciphertextHex>"
 *
 * The key is read from AIDA_ENCRYPTION_KEY (backend .env only — never exposed to the frontend).
 * Each call produces a unique ciphertext because the IV is randomly generated.
 */
export function encryptCredential(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypt a blob produced by encryptCredential().
 * Throws if the key is wrong, the blob is malformed, or the GCM auth tag fails (tampered data).
 */
export function decryptCredential(blob: string): string {
  const key = getKey()
  const parts = blob.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted blob — expected "<iv>:<tag>:<ciphertext>"')
  }
  const [ivHex, tagHex, ciphertextHex] = parts
  if (tagHex.length !== TAG_BYTES * 2) {
    throw new Error('Invalid auth tag length in encrypted blob')
  }
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8')
}
