import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import jwt from 'jsonwebtoken'
import { ROLE_MODULES, ROLE_PERMISSIONS, isModuleAllowed, type AppRole, type ModuleName, type User } from '@aida/shared'
import pb from '../src/lib/pocketbase.js'
import { requireModule } from '../src/middleware/authorize.js'
import { auditMutations, sanitizeAuditChanges, writeAuditRecord } from '../src/middleware/audit.js'
import { requireSetupAccess, resetSetupLockForTests, setSetupComplete } from '../src/middleware/setupLock.js'
import { updateUser } from '../src/routes/users.js'

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

function createViewerFromJwt(): User {
  const token = jwt.sign({ sub: 'viewer-id', email: 'viewer@example.com', role: 'Viewer' }, 'test-secret')
  const payload = jwt.verify(token, 'test-secret') as { sub: string; email: string; role: AppRole }

  return {
    id: payload.sub,
    email: payload.email,
    name: '',
    role: payload.role,
    roles: ROLE_PERMISSIONS[payload.role],
  }
}

function waitForAuditWrite(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

function createAuditResponse(statusCode = 201) {
  const response = new EventEmitter() as EventEmitter & {
    statusCode: number
    json(body: unknown): unknown
  }
  response.statusCode = statusCode
  response.json = (body: unknown) => body
  return response
}

function setPocketBaseAuthenticated(): () => void {
  const originalToken = pb.authStore.token
  const originalRecord = pb.authStore.record
  const token = jwt.sign({ exp: Math.floor(Date.now() / 1000) + 3600 }, 'test-secret')
  pb.authStore.save(token, { id: 'test-superuser' })

  return () => {
    if (originalToken) {
      pb.authStore.save(originalToken, originalRecord)
    } else {
      pb.authStore.clear()
    }
  }
}

async function invokeSetupAccess(token?: string): Promise<{ statusCode?: number; nextCalled: boolean }> {
  const response = createResponse()
  let nextCalled = false
  await requireSetupAccess(
    { get: (header: string) => header === 'authorization' && token ? `Bearer ${token}` : undefined } as never,
    response as never,
    () => { nextCalled = true }
  )
  return { statusCode: response.statusCode, nextCalled }
}

for (const moduleName of [
  'Inventory',
  'Forecasting',
  'Amazon',
  'Inbound Shipments',
  'RMA Tracker',
  'Admin',
] as ModuleName[]) {
  for (const method of ['POST', 'PATCH', 'DELETE']) {
    test(`Viewer JWT is forbidden from ${method} writes to ${moduleName}`, () => {
      const response = createResponse()
      let nextCalled = false

      requireModule(moduleName, 'Editor')(
        { user: createViewerFromJwt() } as never,
        response as never,
        () => {
          nextCalled = true
        }
      )

      assert.equal(response.statusCode, 403)
      assert.deepEqual(response.body, { error: 'Forbidden' })
      assert.equal(nextCalled, false)
    })
  }
}

test('Viewer JWT cannot change a user role', async () => {
  const response = createResponse()

  await updateUser(
    {
      user: createViewerFromJwt(),
      params: { id: 'another-user' },
      body: { role: 'Admin' },
    } as never,
    response as never
  )

  assert.equal(response.statusCode, 403)
  assert.deepEqual(response.body, { error: 'Forbidden' })
})

test('Viewer cannot update another user name', async () => {
  const response = createResponse()

  await updateUser(
    {
      user: createViewerFromJwt(),
      params: { id: 'another-user' },
      body: { name: 'Unauthorized' },
    } as never,
    response as never
  )

  assert.equal(response.statusCode, 403)
  assert.deepEqual(response.body, { error: 'Forbidden' })
})

test('Viewer can update only their own name', async () => {
  const originalCollection = pb.collection.bind(pb)
  let receivedData: unknown
  ;(pb as unknown as { collection: typeof pb.collection }).collection = ((name: string) => {
    if (name === 'users') {
      return {
        update: async (_id: string, data: unknown) => {
          receivedData = data
          return { id: 'viewer-id', name: 'Updated Viewer' }
        },
      }
    }
    return originalCollection(name)
  }) as typeof pb.collection

  try {
    const response = createResponse()
    await updateUser(
      {
        user: createViewerFromJwt(),
        params: { id: 'viewer-id' },
        body: { name: 'Updated Viewer' },
      } as never,
      response as never
    )

    assert.equal(response.statusCode, 200)
    assert.deepEqual(receivedData, { name: 'Updated Viewer' })
  } finally {
    ;(pb as unknown as { collection: typeof pb.collection }).collection = originalCollection
  }
})

test('Viewer cannot update their own email', async () => {
  const response = createResponse()

  await updateUser(
    {
      user: createViewerFromJwt(),
      params: { id: 'viewer-id' },
      body: { email: 'new-viewer@example.com' },
    } as never,
    response as never
  )

  assert.equal(response.statusCode, 403)
  assert.deepEqual(response.body, { error: 'Forbidden' })
})

test('audit middleware writes a record for a successful create', async () => {
  const restoreAuth = setPocketBaseAuthenticated()
  const originalCollection = pb.collection.bind(pb)
  const records: unknown[] = []
  ;(pb as unknown as { collection: typeof pb.collection }).collection = ((name: string) => {
    if (name === 'auditLog') {
      return { create: async (record: unknown) => records.push(record) }
    }
    return originalCollection(name)
  }) as typeof pb.collection

  try {
    const response = createAuditResponse()
    auditMutations(
      {
        method: 'POST',
        path: '/api/inventory/devices',
        body: { name: 'New Device', sku: 'NEW-1' },
        ip: '127.0.0.1',
        user: createViewerFromJwt(),
        get: () => 'test-agent',
      } as never,
      response as never,
      () => response.json({ id: 'device-id' })
    )
    response.emit('finish')
    await waitForAuditWrite()

    assert.deepEqual(records, [{
      actor: 'viewer@example.com',
      action: 'create',
      collection: 'inventory/devices',
      recordId: 'device-id',
      changes: { name: 'New Device', sku: 'NEW-1' },
      ip: '127.0.0.1',
      userAgent: 'test-agent',
    }])
  } finally {
    ;(pb as unknown as { collection: typeof pb.collection }).collection = originalCollection
    restoreAuth()
  }
})

test('audit middleware records actual pre-update values and delete URL IDs', async () => {
  const restoreAuth = setPocketBaseAuthenticated()
  const originalCollection = pb.collection.bind(pb)
  const records: Array<Record<string, unknown>> = []
  ;(pb as unknown as { collection: typeof pb.collection }).collection = ((name: string) => {
    if (name === 'inventoryDevice') {
      return { getOne: async () => ({ id: 'device-id', name: 'Old Device', quantity: 2 }) }
    }
    if (name === 'auditLog') {
      return { create: async (record: Record<string, unknown>) => records.push(record) }
    }
    return originalCollection(name)
  }) as typeof pb.collection

  try {
    const updateResponse = createAuditResponse(200)
    await auditMutations(
      {
        method: 'PATCH',
        path: '/api/inventory/devices/device-id',
        body: { name: 'New Device', quantity: 3 },
        user: createViewerFromJwt(),
        get: () => '',
      } as never,
      updateResponse as never,
      () => updateResponse.json({ id: 'device-id' })
    )
    updateResponse.emit('finish')
    await waitForAuditWrite()

    const deleteResponse = createAuditResponse(204)
    await auditMutations(
      {
        method: 'DELETE',
        path: '/api/inventory/devices/device-id',
        body: {},
        user: createViewerFromJwt(),
        get: () => '',
      } as never,
      deleteResponse as never,
      () => undefined
    )
    deleteResponse.emit('finish')
    await waitForAuditWrite()

    assert.deepEqual(records[0]?.changes, {
      name: { from: 'Old Device', to: 'New Device' },
      quantity: { from: 2, to: 3 },
    })
    assert.equal(records[1]?.recordId, 'device-id')
  } finally {
    ;(pb as unknown as { collection: typeof pb.collection }).collection = originalCollection
    restoreAuth()
  }
})

test('audit middleware skips failed mutations', async () => {
  const restoreAuth = setPocketBaseAuthenticated()
  const originalCollection = pb.collection.bind(pb)
  let writes = 0
  ;(pb as unknown as { collection: typeof pb.collection }).collection = ((name: string) => {
    if (name === 'users') {
      return { getOne: async () => ({ id: 'other', name: 'Existing' }) }
    }
    if (name === 'auditLog') {
      return { create: async () => { writes++ } }
    }
    return originalCollection(name)
  }) as typeof pb.collection

  try {
    const response = createAuditResponse(403)
    auditMutations(
      { method: 'PATCH', path: '/api/users/other', body: { name: 'Blocked' }, user: createViewerFromJwt(), get: () => '' } as never,
      response as never,
      () => response.json({ error: 'Forbidden' })
    )
    response.emit('finish')
    await waitForAuditWrite()

    assert.equal(writes, 0)
  } finally {
    ;(pb as unknown as { collection: typeof pb.collection }).collection = originalCollection
    restoreAuth()
  }
})

test('audit middleware skips PocketBase reads and writes in Setup Mode and logs once', async () => {
  const originalToken = pb.authStore.token
  const originalRecord = pb.authStore.record
  const originalCollection = pb.collection.bind(pb)
  const originalInfo = console.info
  let collectionCalls = 0
  const infoMessages: string[] = []
  pb.authStore.clear()
  ;(pb as unknown as { collection: typeof pb.collection }).collection = (() => {
    collectionCalls++
    throw new Error('PocketBase should not be accessed while unauthenticated')
  }) as typeof pb.collection
  console.info = (message?: unknown) => { infoMessages.push(String(message)) }

  try {
    const response = createAuditResponse()
    let nextCalled = false
    await auditMutations(
      {
        method: 'PATCH',
        path: '/api/inventory/devices/device-id',
        body: { name: 'Updated Device' },
        user: createViewerFromJwt(),
        get: () => '',
      } as never,
      response as never,
      () => { nextCalled = true }
    )
    response.emit('finish')
    await writeAuditRecord({ actor: 'viewer@example.com', action: 'update', collection: 'inventory/devices' })

    assert.equal(nextCalled, true)
    assert.equal(collectionCalls, 0)
    assert.equal(infoMessages.length, 1)
  } finally {
    ;(pb as unknown as { collection: typeof pb.collection }).collection = originalCollection
    console.info = originalInfo
    if (originalToken) {
      pb.authStore.save(originalToken, originalRecord)
    } else {
      pb.authStore.clear()
    }
  }
})

test('audit changes redact secrets and truncate oversized payloads', () => {
  const redacted = sanitizeAuditChanges({
    password: 'secret',
    token: 'jwt-token',
    key: 'encryption-key',
    setupToken: 'setup-token',
    nested: { consumerSecret: 'store-secret' },
  })
  assert.deepEqual(redacted, {
    password: '[REDACTED]',
    token: '[REDACTED]',
    key: '[REDACTED]',
    setupToken: '[REDACTED]',
    nested: { consumerSecret: '[REDACTED]' },
  })

  const truncated = sanitizeAuditChanges({ payload: 'x'.repeat(9 * 1024) })
  assert.equal(truncated.truncated, true)
})

test('audit write failures do not fail the request', async () => {
  const restoreAuth = setPocketBaseAuthenticated()
  const originalCollection = pb.collection.bind(pb)
  ;(pb as unknown as { collection: typeof pb.collection }).collection = ((name: string) => {
    if (name === 'auditLog') {
      return { create: async () => { throw new Error('PocketBase unavailable') } }
    }
    return originalCollection(name)
  }) as typeof pb.collection

  try {
    await assert.doesNotReject(() => writeAuditRecord({
      actor: 'viewer@example.com',
      action: 'create',
      collection: 'inventory/devices',
    }))
  } finally {
    ;(pb as unknown as { collection: typeof pb.collection }).collection = originalCollection
    restoreAuth()
  }
})

test('setup mutation endpoints stay open before setup completes', async () => {
  const priorKey = process.env.AIDA_ENCRYPTION_KEY
  delete process.env.AIDA_ENCRYPTION_KEY
  resetSetupLockForTests()

  try {
    for (const _endpoint of [
      '/api/setup/save-encryption-key',
      '/api/setup/init-collections',
      '/api/setup/set-workspace-mode',
      '/api/setup/complete',
    ]) {
      const result = await invokeSetupAccess()
      assert.equal(result.nextCalled, true)
      assert.equal(result.statusCode, undefined)
    }
  } finally {
    if (priorKey === undefined) delete process.env.AIDA_ENCRYPTION_KEY
    else process.env.AIDA_ENCRYPTION_KEY = priorKey
  }
})

test('completed setup requires the matching hashed bearer token', async () => {
  const originalCollection = pb.collection.bind(pb)
  const token = 'operator-setup-token'
  const setupTokenHash = createHash('sha256').update(token).digest('hex')
  ;(pb as unknown as { collection: typeof pb.collection }).collection = ((name: string) => {
    if (name === 'userPreferences') {
      return { getFirstListItem: async () => ({ id: 'system-preferences', setupTokenHash }) }
    }
    return originalCollection(name)
  }) as typeof pb.collection

  try {
    setSetupComplete()
    const withoutToken = await invokeSetupAccess()
    const wrongToken = await invokeSetupAccess('wrong-token')
    const correctToken = await invokeSetupAccess(token)

    assert.equal(withoutToken.statusCode, 403)
    assert.equal(wrongToken.statusCode, 403)
    assert.equal(correctToken.nextCalled, true)
  } finally {
    resetSetupLockForTests()
    ;(pb as unknown as { collection: typeof pb.collection }).collection = originalCollection
  }
})

test('setup access fails closed when completed-state token lookup errors', async () => {
  const originalCollection = pb.collection.bind(pb)
  ;(pb as unknown as { collection: typeof pb.collection }).collection = ((name: string) => {
    if (name === 'userPreferences') {
      throw new Error('PocketBase unavailable')
    }
    return originalCollection(name)
  }) as typeof pb.collection

  try {
    setSetupComplete()
    const result = await invokeSetupAccess('operator-setup-token')

    assert.equal(result.statusCode, 403)
    assert.equal(result.nextCalled, false)
  } finally {
    resetSetupLockForTests()
    ;(pb as unknown as { collection: typeof pb.collection }).collection = originalCollection
  }
})

test('role changes cannot target the requester and unknown user fields are stripped', async () => {
  const admin: User = {
    id: 'admin-id',
    email: 'admin@example.com',
    name: '',
    role: 'Admin',
    roles: ROLE_PERMISSIONS.Admin,
  }
  const selfResponse = createResponse()

  await updateUser(
    { user: admin, params: { id: admin.id }, body: { role: 'Viewer' } } as never,
    selfResponse as never
  )

  assert.equal(selfResponse.statusCode, 403)

  const originalCollection = pb.collection.bind(pb)
  let receivedData: unknown
  ;(pb as unknown as { collection: typeof pb.collection }).collection = ((name: string) => {
    if (name === 'users') {
      return {
        update: async (_id: string, data: unknown) => {
          receivedData = data
          return { id: 'another-user' }
        },
      }
    }
    return originalCollection(name)
  }) as typeof pb.collection

  try {
    const response = createResponse()
    await updateUser(
      {
        user: admin,
        params: { id: 'another-user' },
        body: { name: 'Updated', isAdmin: true, arbitrary: 'discard' },
      } as never,
      response as never
    )

    assert.equal(response.statusCode, 200)
    assert.deepEqual(receivedData, { name: 'Updated' })
  } finally {
    ;(pb as unknown as { collection: typeof pb.collection }).collection = originalCollection
  }
})

test('Viewer POST (write) to an Inventory endpoint returns 403 after isModuleAllowed pre-check', () => {
  const viewer = createViewerFromJwt()
  assert.equal(viewer.role, 'Viewer')

  // Step 1: Pre-check verification - Viewer is allowed the Inventory module at the top level
  assert.equal(
    isModuleAllowed(viewer.role, 'Inventory'),
    true,
    'Viewer role must pass the top-level isModuleAllowed check for Inventory'
  )

  // Step 2: Write attempt verification - requireModule('Inventory', 'Editor') blocks with 403
  const response = createResponse()
  let nextCalled = false

  requireModule('Inventory', 'Editor')(
    { user: viewer, method: 'POST', path: '/api/inventory/items' } as never,
    response as never,
    () => {
      nextCalled = true
    }
  )

  assert.equal(response.statusCode, 403, 'Viewer write must be rejected with 403')
  assert.deepEqual(response.body, { error: 'Forbidden' })
  assert.equal(nextCalled, false, 'next() must not be called on forbidden write')
})

test('Consistency: for every role in ROLE_MODULES and every route wrapped in RequireModule in App.tsx, frontend can(route) === backend isModuleAllowed(role, module)', () => {
  // Routes wrapped in RequireModule in App.tsx with their configured module requirement
  const routesWrappedInRequireModule = [
    { route: 'forecasting/settings', module: 'settings/forecasting' },
    { route: '/forecasting/settings', module: 'settings/forecasting' },
    { route: 'users', module: 'Admin' },
    { route: '/users', module: 'Admin' },
    { route: 'data', module: 'Admin' },
    { route: '/data', module: 'Admin' },
    { route: 'integrations', module: 'Admin' },
    { route: '/integrations', module: 'Admin' },
  ] as const

  const roles = Object.keys(ROLE_MODULES) as AppRole[]
  const mismatches: Array<{
    role: AppRole
    route: string
    module: string
    frontendCan: boolean
    backendAllowed: boolean
  }> = []

  for (const role of roles) {
    // Frontend can(route) helper simulates AuthContext.can:
    // can(moduleOrRoute) => isModuleAllowed(user.role, moduleOrRoute)
    const frontendCan = (targetRoute: string) => isModuleAllowed(role, targetRoute)

    for (const { route, module } of routesWrappedInRequireModule) {
      const feAllowed = frontendCan(route)
      const beAllowed = isModuleAllowed(role, module)

      if (feAllowed !== beAllowed) {
        mismatches.push({
          role,
          route,
          module,
          frontendCan: feAllowed,
          backendAllowed: beAllowed,
        })
      }
    }
  }

  // Report any mismatches clearly instead of fixing silently
  assert.deepEqual(
    mismatches,
    [],
    `Role-to-module consistency mismatches found: ${JSON.stringify(mismatches, null, 2)}`
  )
})

test('isModuleAllowed normalizes case, slashes, and aliases via ROUTE_TO_MODULE', () => {
  assert.equal(isModuleAllowed('Admin', '/users/'), true)
  assert.equal(isModuleAllowed('Admin', 'USERS'), true)
  assert.equal(isModuleAllowed('Manager', '/users'), false)
  assert.equal(isModuleAllowed('Manager', '/forecasting/settings/'), true)
  assert.equal(isModuleAllowed('Manager', 'settings/forecasting'), true)
  assert.equal(isModuleAllowed('Viewer', '/inventory/devices'), true)
  assert.equal(isModuleAllowed('Viewer', 'INVENTORY'), true)
})