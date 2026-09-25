import { expect, type Page } from '@playwright/test'
import PocketBase from 'pocketbase'

const PB_URL = 'http://127.0.0.1:8090'

const ADMIN_EMAIL = 'smoke-admin@local.aida'
const ADMIN_PASSWORD = 'TestPass123!'

export const SMOKE_USER = {
  email: 'smoke-user@local.aida',
  password: 'SmokeUser123!',
  name: 'Smoke User',
  role: 'Admin',
}

export const SMOKE_DEVICE_RECORDS = [
  {
    sku: 'SMOKE-DEV-001',
    name: 'Smoke Device Alpha',
    onlineStock: 4,
    productionStock: 1,
    warehouseStock: 3,
    reserveStock: 0,
    location: 'SMOKE-A1',
  },
  {
    sku: 'SMOKE-DEV-002',
    name: 'Smoke Device Beta',
    onlineStock: 2,
    productionStock: 0,
    warehouseStock: 5,
    reserveStock: 1,
    location: 'SMOKE-B1',
  },
] as const

export const SMOKE_COMPONENT_RECORDS = [
  {
    sku: 'SMOKE-COMP-001',
    name: 'Smoke Component Cable',
    onlineStock: 3,
    countedStock: 7,
    category: 'Smoke Category',
    subcategory: 'Adapters',
  },
  {
    sku: 'SMOKE-COMP-002',
    name: 'Smoke Component Board',
    onlineStock: 1,
    countedStock: 6,
    category: 'Smoke Category',
    subcategory: 'Boards',
  },
] as const

export const SMOKE_RMA = {
  customerName: 'Smoke Customer',
  ticketNumber: 'SMOKE-TICKET-001',
  orderNumber: 'SMOKE-ORDER-001',
  device: 'Smoke Device Alpha',
  trackingNumber: '1ZSMOKE0000000001',
  status: 'Received',
} as const

function createAdminClient() {
  return new PocketBase(PB_URL)
}

async function adminAuth() {
  const pb = createAdminClient()
  await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD)
  return pb
}

function escapeFilterValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

async function upsertRecord(
  collectionName: string,
  filter: string,
  payload: Record<string, unknown>
) {
  const pb = await adminAuth()
  const existing = await pb.collection(collectionName).getFullList({ filter, fields: 'id' })
  if (existing.length > 0) {
    return pb.collection(collectionName).update(existing[0].id, payload)
  }
  return pb.collection(collectionName).create(payload)
}

export async function ensureSmokeUser() {
  const pb = await adminAuth()
  const filter = `email = "${escapeFilterValue(SMOKE_USER.email)}"`
  const existing = await pb.collection('users').getFullList({ filter, fields: 'id,email' })

  if (existing.length > 0) {
    await pb.collection('users').update(existing[0].id, {
      email: SMOKE_USER.email,
      password: SMOKE_USER.password,
      passwordConfirm: SMOKE_USER.password,
      name: SMOKE_USER.name,
      role: SMOKE_USER.role,
      verified: true,
      emailVisibility: true,
    })
    return
  }

  await pb.collection('users').create({
    email: SMOKE_USER.email,
    password: SMOKE_USER.password,
    passwordConfirm: SMOKE_USER.password,
    name: SMOKE_USER.name,
    role: SMOKE_USER.role,
    verified: true,
    emailVisibility: true,
  })
}

function getIsoWeekParts(offsetWeeks: number) {
  const date = new Date()
  date.setDate(date.getDate() - offsetWeeks * 7)
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return { year: utcDate.getUTCFullYear(), week }
}

export async function ensureSmokeData() {
  for (const device of SMOKE_DEVICE_RECORDS) {
    await upsertRecord(
      'inventoryDevice',
      `sku = "${escapeFilterValue(device.sku)}"`,
      device,
    )
  }

  for (const component of SMOKE_COMPONENT_RECORDS) {
    await upsertRecord(
      'inventoryComponent',
      `sku = "${escapeFilterValue(component.sku)}"`,
      component,
    )
  }

  const pb = await adminAuth()
  const smokeDevice = await pb.collection('inventoryDevice').getFirstListItem(
    `sku = "${escapeFilterValue(SMOKE_DEVICE_RECORDS[0].sku)}"`
  )
  const smokeComponent = await pb.collection('inventoryComponent').getFirstListItem(
    `sku = "${escapeFilterValue(SMOKE_COMPONENT_RECORDS[0].sku)}"`
  )

  for (let offset = 0; offset < 13; offset += 1) {
    const { year, week } = getIsoWeekParts(offset)
    await upsertRecord(
      'salesData',
      `sku = "${escapeFilterValue(SMOKE_DEVICE_RECORDS[0].sku)}" && year = ${year} && week = ${week}`,
      { sku: SMOKE_DEVICE_RECORDS[0].sku, year, week, itemsSold: 2 + (offset % 3) },
    )
    await upsertRecord(
      'salesData',
      `sku = "${escapeFilterValue(SMOKE_COMPONENT_RECORDS[0].sku)}" && year = ${year} && week = ${week}`,
      { sku: SMOKE_COMPONENT_RECORDS[0].sku, year, week, itemsSold: 1 + (offset % 2) },
    )
  }

  await upsertRecord(
    'stockHistory',
    `inventoryItemId = "${escapeFilterValue(smokeDevice.id)}" && operation = "smoke_seed_device"`,
    {
      inventoryItemId: smokeDevice.id,
      field: 'warehouseStock',
      oldValue: 5,
      newValue: 3,
      change: -2,
      operation: 'smoke_seed_device',
    },
  )

  await upsertRecord(
    'stockHistory',
    `inventoryItemId = "${escapeFilterValue(smokeComponent.id)}" && operation = "smoke_seed_component"`,
    {
      inventoryItemId: smokeComponent.id,
      field: 'countedStock',
      oldValue: 8,
      newValue: 7,
      change: -1,
      operation: 'smoke_seed_component',
    },
  )

  await upsertRecord(
    'rmaEntries',
    `orderNumber = "${escapeFilterValue(SMOKE_RMA.orderNumber)}"`,
    {
      ...SMOKE_RMA,
      timestamp: new Date().toISOString(),
    },
  )

  await upsertRecord(
    'inboundShipments',
    `poNumber = "SMOKE-PO-BASE"`,
    {
      poNumber: 'SMOKE-PO-BASE',
      trackingNumber: 'SMOKETRACK001',
      vendor: 'Smoke Vendor',
      shipmentType: 'Air Shipment',
      status: 'In Transit',
      notes: 'Smoke seed shipment',
      items: [{ sku: SMOKE_DEVICE_RECORDS[0].sku, quantity: 2 }],
      customsDocsDownloaded: false,
      importAgentEmailed: false,
      spreadsheetsUpdated: false,
      timestamp: new Date().toISOString(),
    },
  )
}

export async function fetchInboundShipmentByPo(poNumber: string) {
  const pb = await adminAuth()
  return pb.collection('inboundShipments').getFirstListItem(
    `poNumber = "${escapeFilterValue(poNumber)}"`
  )
}

export async function fetchRmaByOrder(orderNumber: string) {
  const pb = await adminAuth()
  return pb.collection('rmaEntries').getFirstListItem(
    `orderNumber = "${escapeFilterValue(orderNumber)}"`
  )
}

export async function loginThroughUi(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.fill('#email', SMOKE_USER.email)
  await page.fill('#password', SMOKE_USER.password)
  await page.getByRole('button', { name: 'Login' }).click()
  await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible({ timeout: 20000 })
}

export async function dismissDialog(page: Page, accept: boolean) {
  const dialog = page.locator('text=Confirm').or(page.locator('text=Receive Shipment')).first()
  await expect(dialog).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: accept ? /confirm|yes|receive/i : /cancel|no/i }).first().click()
}