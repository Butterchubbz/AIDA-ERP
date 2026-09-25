import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH_BYTES = 12
const TAG_LENGTH_BYTES = 16

export function getEncryptionKey(): Buffer {
  const keyHex = process.env.AIDA_ENCRYPTION_KEY?.trim()

  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      'AIDA_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Run the setup wizard or set the local environment value.'
    )
  }

  return Buffer.from(keyHex, 'hex')
}

/**
 * Encrypt plaintext data using AES-256-GCM.
 * Output format: <ivHex>:<ciphertextHex>
 *
 * The GCM auth tag is appended to the ciphertext and validated during decryption.
 */
export function encryptCredential(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${Buffer.concat([ciphertext, tag]).toString('hex')}`
}

/**
 * Decrypt a credential blob created by encryptCredential().
 * Input is expected to be: <ivHex>:<ciphertextHex>
 */
export function decryptCredential(encryptedString: string): string {
  const key = getEncryptionKey()

  if (!encryptedString || typeof encryptedString !== 'string') {
    throw new Error('Encrypted credential is empty or malformed.')
  }

  const [ivHex, payloadHex] = encryptedString.split(':')
  if (!ivHex || !payloadHex) {
    throw new Error('Encrypted credential format is invalid. Expected <ivHex>:<ciphertextHex>.')
  }

  const iv = Buffer.from(ivHex, 'hex')
  const payload = Buffer.from(payloadHex, 'hex')

  if (iv.length !== IV_LENGTH_BYTES) {
    throw new Error('Encrypted credential IV length is invalid.')
  }

  if (payload.length <= TAG_LENGTH_BYTES) {
    throw new Error('Encrypted credential payload is incomplete.')
  }

  const ciphertext = payload.subarray(0, payload.length - TAG_LENGTH_BYTES)
  const tag = payload.subarray(payload.length - TAG_LENGTH_BYTES)

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return decrypted.toString('utf8')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Decryption failed'
    throw new Error(`Credential decryption failed: ${message}`)
  }
}
