const IV_LENGTH_BYTES = 12
const TAG_LENGTH_BYTES = 16
const KEY_DERIVATION_SALT = 'aida-erp-client-credential-v1'

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/^0x/i, '').trim()
  if (cleaned.length % 2 !== 0) {
    throw new Error('Invalid hex input')
  }

  const bytes = new Uint8Array(cleaned.length / 2)
  for (let index = 0; index < cleaned.length; index += 2) {
    bytes[index / 2] = Number.parseInt(cleaned.slice(index, index + 2), 16)
  }
  return bytes
}

async function deriveAesKey(setupToken: string): Promise<CryptoKey> {
  if (!setupToken.trim()) {
    throw new Error('A setup token is required to encrypt client-side secrets.')
  }

  const encoder = new TextEncoder()
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(setupToken),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(KEY_DERIVATION_SALT),
      iterations: 250_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
}

/**
 * Encrypt a plaintext credential using the browser's native Web Crypto API.
 * Output format: <ivHex>:<ciphertextHex>
 *
 * The ciphertext includes the AES-GCM authentication tag as the final 16 bytes of the payload,
 * which is validated during backend decryption and prevents tampered data from being accepted.
 */
export async function encryptCredential(value: string, setupToken: string): Promise<string> {
  if (!value) {
    throw new Error('Credential value cannot be empty.')
  }

  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES))
  const key = await deriveAesKey(setupToken)
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    new TextEncoder().encode(value)
  )

  return `${bytesToHex(iv)}:${bytesToHex(new Uint8Array(encrypted))}`
}

export async function decryptCredential(encryptedString: string, setupToken: string): Promise<string> {
  const [ivHex, payloadHex] = encryptedString.split(':')
  if (!ivHex || !payloadHex) {
    throw new Error('Malformed encrypted credential payload.')
  }

  const iv = hexToBytes(ivHex)
  const raw = hexToBytes(payloadHex)
  if (raw.length <= TAG_LENGTH_BYTES) {
    throw new Error('Encrypted credential payload is incomplete.')
  }

  const ciphertext = raw.slice(0, raw.length - TAG_LENGTH_BYTES)
  const tag = raw.slice(raw.length - TAG_LENGTH_BYTES)
  const key = await deriveAesKey(setupToken)

  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    new Uint8Array([...ciphertext, ...tag])
  )

  return new TextDecoder().decode(decrypted)
}
