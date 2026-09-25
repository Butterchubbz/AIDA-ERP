import assert from 'node:assert/strict'
import test from 'node:test'
import os from 'node:os'
import path from 'node:path'
import { readFile, rm } from 'node:fs/promises'
import pb from '../src/lib/pocketbase.js'
import {
  getSuperuserBootstrapStatus,
  createSuperuserViaWizard,
  resetSuperuserBootstrapRateLimitForTests,
} from '../src/routes/setup.js'

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

function createRequest(body: unknown, ip = '127.0.0.1') {
  return { body, ip } as never
}

const tmpEnvPath = path.join(os.tmpdir(), `aida-setup-bootstrap-test-${process.pid}.env`)

function withTestHarness(fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    process.env.AIDA_SETUP_ENV_FILE_OVERRIDE = tmpEnvPath
    delete process.env.PB_ADMIN_EMAIL
    delete process.env.PB_ADMIN_PASSWORD
    resetSuperuserBootstrapRateLimitForTests()

    const originalCollection = pb.collection.bind(pb)
    ;(pb as unknown as { collection: typeof pb.collection }).collection = ((name: string) => {
      if (name === '_superusers') {
        return { authWithPassword: async () => ({}) }
      }
      return originalCollection(name)
    }) as typeof pb.collection

    try {
      await fn()
    } finally {
      ;(pb as unknown as { collection: typeof pb.collection }).collection = originalCollection
      delete process.env.AIDA_SETUP_ENV_FILE_OVERRIDE
      delete process.env.PB_ADMIN_EMAIL
      delete process.env.PB_ADMIN_PASSWORD
      await rm(tmpEnvPath, { force: true })
    }
  }
}

function mockPbSend(config: { bootstrapAvailable?: boolean; bootstrapPostError?: { status: number } }): () => void {
  const originalSend = pb.send.bind(pb)

  ;(pb as unknown as { send: typeof pb.send }).send = (async (sendPath: string, options?: { method?: string }) => {
    if (sendPath === '/api/aida/bootstrap-superuser') {
      if (options?.method === 'GET') {
        return { available: config.bootstrapAvailable ?? true }
      }
      if (options?.method === 'POST') {
        if (config.bootstrapPostError) {
          throw Object.assign(new Error('bootstrap rejected'), { status: config.bootstrapPostError.status })
        }
        return { status: 'created' }
      }
    }

    if (sendPath.startsWith('/api/collections/')) {
      throw Object.assign(new Error('not found'), { status: 404 })
    }

    if (sendPath === '/api/collections') {
      return { id: 'stub-collection' }
    }

    throw new Error(`Unexpected pb.send call in test: ${sendPath}`)
  }) as typeof pb.send

  return () => {
    ;(pb as unknown as { send: typeof pb.send }).send = originalSend
  }
}

test(
  '(a) fresh install allows the wizard to create the PocketBase superuser',
  withTestHarness(async () => {
    const restoreSend = mockPbSend({ bootstrapAvailable: true })

    try {
      const statusResponse = createResponse()
      await getSuperuserBootstrapStatus({} as never, statusResponse as never)
      assert.equal(statusResponse.statusCode, 200)
      assert.deepEqual(statusResponse.body, { available: true })

      const createResult = createResponse()
      await createSuperuserViaWizard(
        createRequest({ email: 'owner@example.com', password: 'super-secret-pass' }),
        createResult as never
      )

      assert.equal(createResult.statusCode, 200)
      assert.deepEqual(createResult.body, { status: 'created' })

      const envContents = await readFile(tmpEnvPath, 'utf8')
      assert.match(envContents, /PB_ADMIN_EMAIL=owner@example\.com/)
      assert.match(envContents, /PB_ADMIN_PASSWORD=super-secret-pass/)
    } finally {
      restoreSend()
    }
  })
)

test(
  '(b) creation locks the endpoint for the remainder of the volume lifetime',
  withTestHarness(async () => {
    // Simulates PocketBase's own state after a superuser now exists.
    const restoreSend = mockPbSend({ bootstrapAvailable: false })

    try {
      const statusResponse = createResponse()
      await getSuperuserBootstrapStatus({} as never, statusResponse as never)

      assert.equal(statusResponse.statusCode, 200)
      assert.deepEqual(statusResponse.body, { available: false })
    } finally {
      restoreSend()
    }
  })
)

test(
  '(c) POST returns 403 once PocketBase reports the install is no longer fresh',
  withTestHarness(async () => {
    const restoreSend = mockPbSend({ bootstrapPostError: { status: 403 } })

    try {
      const response = createResponse()
      await createSuperuserViaWizard(
        createRequest({ email: 'owner@example.com', password: 'super-secret-pass' }),
        response as never
      )

      assert.equal(response.statusCode, 403)
    } finally {
      restoreSend()
    }
  })
)

test(
  '(d) env-credential mode disables the wizard endpoint entirely',
  withTestHarness(async () => {
    process.env.PB_ADMIN_EMAIL = 'preset@example.com'
    process.env.PB_ADMIN_PASSWORD = 'preset-strong-password'

    const statusResponse = createResponse()
    await getSuperuserBootstrapStatus({} as never, statusResponse as never)
    assert.equal(statusResponse.statusCode, 200)
    assert.deepEqual(statusResponse.body, { available: false, reason: 'env-credentials' })

    const createResult = createResponse()
    await createSuperuserViaWizard(
      createRequest({ email: 'attacker@example.com', password: 'attacker-strong-pw' }),
      createResult as never
    )

    assert.equal(createResult.statusCode, 403)
  })
)

test(
  'rate limit throttles repeated attempts from the same IP (defense-in-depth)',
  withTestHarness(async () => {
    const restoreSend = mockPbSend({ bootstrapPostError: { status: 403 } })

    try {
      for (let i = 0; i < 5; i++) {
        const response = createResponse()
        await createSuperuserViaWizard(
          createRequest({ email: 'owner@example.com', password: 'super-secret-pass' }, '10.0.0.1'),
          response as never
        )
        assert.equal(response.statusCode, 403)
      }

      const throttled = createResponse()
      await createSuperuserViaWizard(
        createRequest({ email: 'owner@example.com', password: 'super-secret-pass' }, '10.0.0.1'),
        throttled as never
      )
      assert.equal(throttled.statusCode, 429)
    } finally {
      restoreSend()
    }
  })
)
