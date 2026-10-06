import assert from 'node:assert/strict'
import test from 'node:test'
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

function withTestHarness(fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    const originalCollection = pb.collection.bind(pb)
    const originalSend = pb.send.bind(pb)
    const priorKey = process.env.AIDA_ENCRYPTION_KEY

    // Set valid 64-hex encryption key by default for tests
    process.env.AIDA_ENCRYPTION_KEY = 'a'.repeat(64)

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
    assert.equal(infoMessages.length, 1)
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
