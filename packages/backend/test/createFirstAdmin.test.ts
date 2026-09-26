import assert from 'node:assert/strict'
import test from 'node:test'
import pb from '../src/lib/pocketbase.js'
import { createFirstAdmin } from '../src/routes/setup.js'

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

function createRequest(body: unknown) {
  return { body } as never
}

function withTestHarness(fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    const originalCollection = pb.collection.bind(pb)
    const originalSend = pb.send.bind(pb)

    try {
      await fn()
    } finally {
      ;(pb as unknown as { collection: typeof pb.collection }).collection = originalCollection
      ;(pb as unknown as { send: typeof pb.send }).send = originalSend
    }
  }
}

test('createFirstAdmin rejects when name is missing', async () => {
  const res = createResponse()
  await createFirstAdmin(createRequest({ email: 'admin@example.com', password: 'password12345' }), res as never)
  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body, { error: 'Name is required.' })
})

test('createFirstAdmin rejects when email is invalid', async () => {
  const res = createResponse()
  await createFirstAdmin(createRequest({ name: 'Admin', email: 'invalid-email', password: 'password12345' }), res as never)
  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body, { error: 'A valid email address is required.' })
})

test('createFirstAdmin rejects when password is less than 10 characters', async () => {
  const res = createResponse()
  await createFirstAdmin(createRequest({ name: 'Admin', email: 'admin@example.com', password: 'short' }), res as never)
  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body, { error: 'Password must be at least 10 characters long.' })
})

test(
  'createFirstAdmin creates admin user when users collection has 0 records and stores setupOwnerEmail',
  withTestHarness(async () => {
    let createdUserPayload: Record<string, unknown> | null = null
    let updatedPrefsPayload: Record<string, unknown> | null = null

    ;(pb as unknown as { send: typeof pb.send }).send = (async (path: string) => {
      if (path.startsWith('/api/collections/')) {
        return { id: 'users-id', fields: [{ name: 'name' }] }
      }
      return {}
    }) as typeof pb.send

    ;(pb as unknown as { collection: typeof pb.collection }).collection = ((name: string) => {
      if (name === '_superusers') {
        return { authWithPassword: async () => ({}) }
      }
      if (name === 'users') {
        return {
          getList: async () => ({ items: [], totalItems: 0 }),
          create: async (data: Record<string, unknown>) => {
            createdUserPayload = data
            return { id: 'admin-id-123', ...data }
          },
        }
      }
      if (name === 'userPreferences') {
        return {
          getFirstListItem: async () => ({ id: 'prefs-id-1', userId: 'system' }),
          update: async (_id: string, data: Record<string, unknown>) => {
            updatedPrefsPayload = data
            return { id: 'prefs-id-1', ...data }
          },
          create: async (data: Record<string, unknown>) => {
            updatedPrefsPayload = data
            return { id: 'prefs-id-1', ...data }
          },
        }
      }
      return {
        getList: async () => ({ items: [] }),
      }
    }) as typeof pb.collection

    const res = createResponse()
    await createFirstAdmin(
      createRequest({ name: 'Primary Admin', email: 'Owner@Example.COM', password: 'SecurePassword123' }),
      res as never
    )

    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, {
      status: 'created',
      user: {
        id: 'admin-id-123',
        name: 'Primary Admin',
        email: 'owner@example.com',
        role: 'Admin',
      },
    })

    assert.equal(createdUserPayload?.['name'], 'Primary Admin')
    assert.equal(createdUserPayload?.['email'], 'owner@example.com')
    assert.equal(createdUserPayload?.['role'], 'Admin')
    assert.equal(createdUserPayload?.['verified'], true)
    assert.equal(updatedPrefsPayload?.['setupOwnerEmail'], 'owner@example.com')
  })
)

test(
  'createFirstAdmin rejects with 403 when users collection already contains a record',
  withTestHarness(async () => {
    ;(pb as unknown as { send: typeof pb.send }).send = (async () => ({})) as typeof pb.send

    ;(pb as unknown as { collection: typeof pb.collection }).collection = ((name: string) => {
      if (name === '_superusers') {
        return { authWithPassword: async () => ({}) }
      }
      if (name === 'users') {
        return {
          getList: async () => ({
            items: [{ id: 'existing-user-1', email: 'existing@example.com' }],
            totalItems: 1,
          }),
        }
      }
      return {}
    }) as typeof pb.collection

    const res = createResponse()
    await createFirstAdmin(
      createRequest({ name: 'Second Admin', email: 'second@example.com', password: 'SecurePassword123' }),
      res as never
    )

    assert.equal(res.statusCode, 403)
    assert.deepEqual(res.body, { error: 'Admin user creation is no longer available.' })
  })
)
