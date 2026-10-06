import assert from 'node:assert/strict'
import test from 'node:test'

const originalAllowedOrigins = process.env.ALLOWED_ORIGIN
process.env.ALLOWED_ORIGIN = 'http://localhost:5173,http://localhost:8090'
const { csrfOriginGuard } = await import('../src/middleware/csrf.js')

if (originalAllowedOrigins === undefined) {
  delete process.env.ALLOWED_ORIGIN
} else {
  process.env.ALLOWED_ORIGIN = originalAllowedOrigins
}

interface MockResponse {
  statusCode?: number
  body?: unknown
  status(code: number): MockResponse
  json(payload: unknown): MockResponse
}

function createResponse(): MockResponse {
  return {
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: unknown) {
      this.body = payload
      return this
    },
  }
}

function invokeGuard(origin: string) {
  const response = createResponse()
  let nextCalled = false

  csrfOriginGuard(
    {
      method: 'POST',
      path: '/api/test',
      protocol: 'http',
      hostname: 'localhost',
      headers: { origin },
    } as never,
    response as never,
    () => { nextCalled = true }
  )

  return { response, nextCalled }
}

test('allows same-origin mutation on the configured backend port outside the allowlist', () => {
  const originalPort = process.env.PORT
  process.env.PORT = '3001'

  try {
    const { response, nextCalled } = invokeGuard('http://localhost:3001')
    assert.equal(nextCalled, true)
    assert.equal(response.statusCode, undefined)
  } finally {
    if (originalPort === undefined) {
      delete process.env.PORT
    } else {
      process.env.PORT = originalPort
    }
  }
})

test('still allows a cross-origin mutation when its origin is allowlisted', () => {
  const { response, nextCalled } = invokeGuard('http://localhost:5173')
  assert.equal(nextCalled, true)
  assert.equal(response.statusCode, undefined)
})

test('blocks a cross-origin mutation that is not allowlisted', () => {
  const { response, nextCalled } = invokeGuard('http://attacker.example')
  assert.equal(nextCalled, false)
  assert.equal(response.statusCode, 403)
  assert.deepEqual(response.body, { error: 'CSRF Protection: Origin Not Allowed' })
})
