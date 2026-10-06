import assert from 'node:assert/strict'
import test from 'node:test'
import jwt from 'jsonwebtoken'
import pb from '../src/lib/pocketbase.js'
import { bootstrapMissingCollections, checkSetupHealth, evaluateSetupState } from '../src/routes/setup.js'

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

function createRequest() {
  return {} as never
}

test('consecutive unauthenticated health checks skip collections and log Setup Mode at most once', async () => {
  const originalToken = pb.authStore.token
  const originalRecord = pb.authStore.record
  const originalCollection = pb.collection.bind(pb)
  const originalSend = pb.send.bind(pb)
  const originalEmail = process.env.PB_ADMIN_EMAIL
  const originalPassword = process.env.PB_ADMIN_PASSWORD
  const originalLog = console.log
  const originalInfo = console.info
  let collectionCalls = 0
  const setupModeLogs: string[] = []

  process.env.PB_ADMIN_EMAIL = 'owner@example.com'
  process.env.PB_ADMIN_PASSWORD = 'test-password'
  pb.authStore.clear()
  ;(pb as unknown as { collection: typeof pb.collection }).collection = (() => {
    collectionCalls++
    throw new Error('Health checks must not query collections without a PB session')
  }) as typeof pb.collection
  ;(pb as unknown as { send: typeof pb.send }).send = (async (sendPath: string) => {
    if (sendPath === '/api/health') return { code: 200 }
    throw new Error(`Unexpected PocketBase request: ${sendPath}`)
  }) as typeof pb.send
  const captureSetupLog = (...args: unknown[]) => {
    const message = args.map(String).join(' ')
    if (/Setup Mode|superuser session unavailable/i.test(message)) setupModeLogs.push(message)
  }
  console.log = captureSetupLog
  console.info = captureSetupLog

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = createResponse()
      await checkSetupHealth(createRequest(), response as never)

      assert.equal(response.statusCode, 200)
      assert.equal((response.body as { pocketbase: string }).pocketbase, 'ok')
      assert.equal((response.body as { setupComplete: boolean }).setupComplete, false)
    }

    assert.equal(collectionCalls, 0)
    assert.ok(setupModeLogs.length <= 1)
  } finally {
    ;(pb as unknown as { collection: typeof pb.collection }).collection = originalCollection
    ;(pb as unknown as { send: typeof pb.send }).send = originalSend
    console.log = originalLog
    console.info = originalInfo
    if (originalEmail === undefined) delete process.env.PB_ADMIN_EMAIL
    else process.env.PB_ADMIN_EMAIL = originalEmail
    if (originalPassword === undefined) delete process.env.PB_ADMIN_PASSWORD
    else process.env.PB_ADMIN_PASSWORD = originalPassword
    if (originalToken) pb.authStore.save(originalToken, originalRecord)
    else pb.authStore.clear()
  }
})

function withTestHarness(fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    const originalCollection = pb.collection.bind(pb)
    const originalSend = pb.send.bind(pb)
    const originalToken = pb.authStore.token
    const originalRecord = pb.authStore.record
    const priorKey = process.env.AIDA_ENCRYPTION_KEY

    // Set valid 64-hex encryption key by default for tests
    process.env.AIDA_ENCRYPTION_KEY = 'a'.repeat(64)
    pb.authStore.save(
      jwt.sign({ exp: Math.floor(Date.now() / 1000) + 3600 }, 'test-secret'),
      { id: 'test-superuser' }
    )

    try {
      await fn()
    } finally {
      ;(pb as unknown as { collection: typeof pb.collection }).collection = originalCollection
      ;(pb as unknown as { send: typeof pb.send }).send = originalSend
      if (priorKey === undefined) {
        delete process.env.AIDA_ENCRYPTION_KEY
      } else {
        process.env.AIDA_ENCRYPTION_KEY = priorKey
      }
      if (originalToken) pb.authStore.save(originalToken, originalRecord)
      else pb.authStore.clear()
    }
  }
}

test('collection bootstrap backs off without a PocketBase session and logs only once', async () => {
  const originalToken = pb.authStore.token
  const originalRecord = pb.authStore.record
  const originalCollection = pb.collection.bind(pb)
  const originalSend = pb.send.bind(pb)
  const originalInfo = console.info
  let pbCalls = 0
  const infoMessages: string[] = []
  pb.authStore.clear()
  ;(pb as unknown as { collection: typeof pb.collection }).collection = (() => {
    pbCalls++
    throw new Error('Collection bootstrap must not access PocketBase without a session')
  }) as typeof pb.collection
  ;(pb as unknown as { send: typeof pb.send }).send = (async () => {
    pbCalls++
    throw new Error('Collection bootstrap must not send requests without a session')
  }) as typeof pb.send
  console.info = (message?: unknown) => { infoMessages.push(String(message)) }

  try {
    await bootstrapMissingCollections()
    await bootstrapMissingCollections()

    assert.equal(pbCalls, 0)
    assert.ok(infoMessages.length <= 1)
  } finally {
    ;(pb as unknown as { collection: typeof pb.collection }).collection = originalCollection
    ;(pb as unknown as { send: typeof pb.send }).send = originalSend
    console.info = originalInfo
    if (originalToken) {
      pb.authStore.save(originalToken, originalRecord)
    } else {
      pb.authStore.clear()
    }
  }
})

test(
  'setup health reports setupComplete: false and users: missing when zero users exist',
  withTestHarness(async () => {
    ;(pb as unknown as { send: typeof pb.send }).send = (async (sendPath: string) => {
      if (sendPath === '/api/health') return { code: 200 }
      if (sendPath.startsWith('/api/collections/')) return { id: 'col-id' }
      return {}
    }) as typeof pb.send

    ;(pb as unknown as { collection: typeof pb.collection }).collection = ((name: string) => {
      if (name === '_superusers') {
        return { authWithPassword: async () => ({}) }
      }
      if (name === 'users') {
        return {
          getList: async () => ({ items: [], totalItems: 0 }),
        }
      }
      return {
        getList: async () => ({ items: [] }),
      }
    }) as typeof pb.collection

    const res = createResponse()
    await checkSetupHealth(createRequest(), res as never)

    assert.equal(res.statusCode, 200)
    const body = res.body as {
      backend: string
      pocketbase: string
      setupComplete: boolean
      checks: Record<string, string>
    }

    assert.equal(body.backend, 'ok')
    assert.equal(body.pocketbase, 'ok')
    assert.equal(body.setupComplete, false)
    assert.equal(body.checks.users, 'missing')
    assert.equal(body.checks.encryptionKey, 'ok')
  })
)

test(
  'setup health reports setupComplete: true and users: exists when at least one user exists',
  withTestHarness(async () => {
    ;(pb as unknown as { send: typeof pb.send }).send = (async (sendPath: string) => {
      if (sendPath === '/api/health') return { code: 200 }
      if (sendPath.startsWith('/api/collections/')) return { id: 'col-id' }
      return {}
    }) as typeof pb.send

    ;(pb as unknown as { collection: typeof pb.collection }).collection = ((name: string) => {
      if (name === '_superusers') {
        return { authWithPassword: async () => ({}) }
      }
      if (name === 'users') {
        return {
          getList: async () => ({ items: [{ id: 'user-1' }], totalItems: 1 }),
        }
      }
      return {
        getList: async () => ({ items: [] }),
      }
    }) as typeof pb.collection

    const res = createResponse()
    await checkSetupHealth(createRequest(), res as never)

    assert.equal(res.statusCode, 200)
    const body = res.body as {
      backend: string
      pocketbase: string
      setupComplete: boolean
      checks: Record<string, string>
    }

    assert.equal(body.backend, 'ok')
    assert.equal(body.pocketbase, 'ok')
    assert.equal(body.setupComplete, true)
    assert.equal(body.checks.users, 'exists')
    assert.equal(body.checks.encryptionKey, 'ok')
  })
)

test(
  'setup health reports users: failed and setupComplete: false when users query errors',
  withTestHarness(async () => {
    ;(pb as unknown as { send: typeof pb.send }).send = (async (sendPath: string) => {
      if (sendPath === '/api/health') return { code: 200 }
      if (sendPath.startsWith('/api/collections/')) return { id: 'col-id' }
      return {}
    }) as typeof pb.send

    ;(pb as unknown as { collection: typeof pb.collection }).collection = ((name: string) => {
      if (name === '_superusers') {
        return { authWithPassword: async () => ({}) }
      }
      if (name === 'users') {
        return {
          getList: async () => {
            throw new Error('Database locked')
          },
        }
      }
      return {
        getList: async () => ({ items: [] }),
      }
    }) as typeof pb.collection

    const res = createResponse()
    await checkSetupHealth(createRequest(), res as never)

    assert.equal(res.statusCode, 200)
    const body = res.body as {
      backend: string
      pocketbase: string
      setupComplete: boolean
      checks: Record<string, string>
    }

    assert.equal(body.setupComplete, false)
    assert.equal(body.checks.users, 'failed')
  })
)

test(
  'setup health reports setupComplete: false when encryption key is missing even if users exist',
  withTestHarness(async () => {
    delete process.env.AIDA_ENCRYPTION_KEY

    ;(pb as unknown as { send: typeof pb.send }).send = (async (sendPath: string) => {
      if (sendPath === '/api/health') return { code: 200 }
      if (sendPath.startsWith('/api/collections/')) return { id: 'col-id' }
      return {}
    }) as typeof pb.send

    ;(pb as unknown as { collection: typeof pb.collection }).collection = ((name: string) => {
      if (name === '_superusers') {
        return { authWithPassword: async () => ({}) }
      }
      if (name === 'users') {
        return {
          getList: async () => ({ items: [{ id: 'user-1' }], totalItems: 1 }),
        }
      }
      return {
        getList: async () => ({ items: [] }),
      }
    }) as typeof pb.collection

    const res = createResponse()
    await checkSetupHealth(createRequest(), res as never)

    assert.equal(res.statusCode, 200)
    const body = res.body as {
      setupComplete: boolean
      checks: Record<string, string>
    }

    assert.equal(body.setupComplete, false)
    assert.equal(body.checks.encryptionKey, 'missing')
    assert.equal(body.checks.users, 'exists')
  })
)

test(
  'setup health reports setupComplete: false when a required collection is missing',
  withTestHarness(async () => {
    ;(pb as unknown as { send: typeof pb.send }).send = (async (sendPath: string) => {
      if (sendPath === '/api/health') return { code: 200 }
      // simulate inventoryDevice missing
      if (sendPath.includes('inventoryDevice')) {
        throw Object.assign(new Error('Collection not found'), { status: 404 })
      }
      if (sendPath.startsWith('/api/collections/')) return { id: 'col-id' }
      return {}
    }) as typeof pb.send

    ;(pb as unknown as { collection: typeof pb.collection }).collection = ((name: string) => {
      if (name === '_superusers') {
        return { authWithPassword: async () => ({}) }
      }
      if (name === 'users') {
        return {
          getList: async () => ({ items: [{ id: 'user-1' }], totalItems: 1 }),
        }
      }
      return {
        getList: async () => ({ items: [] }),
      }
    }) as typeof pb.collection

    const state = await evaluateSetupState()

    assert.equal(state.setupComplete, false)
    assert.equal(state.inventoryDevice, 'missing')
    assert.equal(state.users, 'exists')
  })
)
