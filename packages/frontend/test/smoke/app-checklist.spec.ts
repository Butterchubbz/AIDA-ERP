import { test, expect } from '@playwright/test'
import {
  SMOKE_COMPONENT_RECORDS,
  SMOKE_DEVICE_RECORDS,
  SMOKE_RMA,
  ensureSmokeData,
  ensureSmokeUser,
  fetchInboundShipmentByPo,
  fetchRmaByOrder,
  loginThroughUi,
} from './smokeTestHelpers'

test.describe('AIDA checklist smoke tests', () => {
  test.beforeAll(async () => {
    await ensureSmokeUser()
    await ensureSmokeData()
  })

  test('core: app loads and landing shows setup or login', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('aida_setup_complete')
      localStorage.removeItem('pocketbase_auth')
    })

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => Boolean(document.body?.innerText?.trim()), { timeout: 15000 })

    const setupHeading = page.getByText(/AIDA Setup|Setup: PocketBase Collections/i)
    const loginHeading = page.getByRole('heading', { name: /AIDA Login/i })
    await expect(setupHeading.or(loginHeading).first()).toBeVisible({ timeout: 15000 })
  })

  test('core: can log in', async ({ page }) => {
    await loginThroughUi(page)
    await expect(page).toHaveURL(/dashboard|127\.0\.0\.1:5174\/$/, { timeout: 20000 })
  })

  test('inventory: device list loads, drag persists, count order matches, history modal opens', async ({ page }) => {
    await loginThroughUi(page)
    await page.goto('/inventory/devices')

    const deviceRows = () => page.locator('table tbody tr')
    const rows = deviceRows()
    await expect(rows.first()).toBeVisible()
    await expect(page.getByText(SMOKE_DEVICE_RECORDS[0].name)).toBeVisible()

    const before = await rows.evaluateAll(trs =>
      trs.slice(0, 3).map(tr => tr.querySelectorAll('td')[1]?.textContent?.trim() ?? '')
    )

    const draggableRows = page.locator('[data-rfd-draggable-id]')
    const sourceBox = await draggableRows.nth(2).boundingBox()
    const targetBox = await draggableRows.nth(0).boundingBox()
    expect(sourceBox).not.toBeNull()
    expect(targetBox).not.toBeNull()

    await page.mouse.move(
      sourceBox!.x + sourceBox!.width / 2,
      sourceBox!.y + sourceBox!.height / 2,
    )
    await page.mouse.down()
    await page.mouse.move(
      targetBox!.x + targetBox!.width / 2,
      targetBox!.y + targetBox!.height / 2,
      { steps: 20 },
    )
    await page.mouse.up()

    await expect.poll(async () => {
      return rows.evaluateAll(trs =>
        trs.slice(0, 3).map(tr => tr.querySelectorAll('td')[1]?.textContent?.trim() ?? '')
      )
    }, { timeout: 10000 }).not.toEqual(before)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect.poll(async () => {
      return deviceRows().evaluateAll(trs =>
        trs.slice(0, 3).map(tr => tr.querySelectorAll('td')[1]?.textContent?.trim() ?? '')
      )
    }).not.toEqual(before)

    await expect(deviceRows().first()).toBeVisible()
    const listNames = await deviceRows().evaluateAll(trs =>
      trs.slice(0, 5).map(tr => tr.querySelectorAll('td')[1]?.textContent?.trim() ?? '')
    )

    await page.getByRole('button', { name: /Count Stock/i }).click()
    const modalHeading = page.getByRole('heading', { name: /Stock Count for device/i })
    await expect(modalHeading).toBeVisible()
    const modal = modalHeading.locator('..').locator('..')
    const modalNames = await modal.locator('div.max-h-96 > div > span').evaluateAll(spans =>
      spans.slice(0, 5).map(span => span.textContent?.trim() ?? '')
    )
    expect(modalNames).toEqual(listNames)
    await page.getByRole('button', { name: 'Cancel' }).click()

    await deviceRows().first().getByRole('button', { name: 'History' }).click()
    await expect(page.getByText(/Stock History -/i)).toBeVisible()
    await expect(page.getByText(/No history recorded yet|Operation|Loading history/i)).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()
  })

  test('inventory: component list loads grouped by category', async ({ page }) => {
    await loginThroughUi(page)
    await page.goto('/inventory/components')
    await expect(page.getByText('Smoke Category')).toBeVisible()
    await expect(page.getByText('Adapters')).toBeVisible()
    await expect(page.getByText('Boards')).toBeVisible()
    await expect(page.getByText(SMOKE_COMPONENT_RECORDS[0].name)).toBeVisible()
  })

  test('inbound shipments: list loads, add persists, status persists, receive confirms', async ({ page }) => {
    await loginThroughUi(page)
    await page.goto('/shipments/inbound')

    await expect(page.getByRole('heading', { name: /Inbound Shipments/i })).toBeVisible()

    const poNumber = `SMOKE-PO-${Date.now()}`
    await page.getByRole('button', { name: /Add New Shipment/i }).click()
    await expect(page.getByRole('heading', { name: /New Inbound Shipment/i })).toBeVisible()
    await page.fill('#po-number', poNumber)
    await page.fill('#tracking-number', `SMOKE-TRACK-${Date.now()}`)
    await page.fill('#vendor', 'Smoke Vendor UI')
    await page.fill('#sku-0', SMOKE_DEVICE_RECORDS[0].sku)
    await page.fill('#quantity-0', '3')
    await page.getByRole('button', { name: /Add Shipment/i }).click()
    await expect(page.getByText(/Inbound shipment added successfully/i)).toBeVisible({ timeout: 15000 })

    const savedShipment = await fetchInboundShipmentByPo(poNumber)
    expect(savedShipment.poNumber).toBe(poNumber)
    expect(Array.isArray(savedShipment.items)).toBeTruthy()
    expect(savedShipment.items[0]?.sku).toBe(SMOKE_DEVICE_RECORDS[0].sku)
    expect(savedShipment.items[0]?.quantity).toBe(3)

    const seededRow = page.locator('tr', { hasText: 'SMOKE-PO-BASE' }).first()
    await expect(seededRow).toBeVisible()
    await seededRow.locator('select').selectOption('Arrived at Customs')
    await expect(page.getByText(/Shipment status updated/i)).toBeVisible({ timeout: 10000 })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('tr', { hasText: 'SMOKE-PO-BASE' }).locator('select')).toHaveValue('Arrived at Customs')

    const receiveRow = page.locator('tr', { hasText: poNumber }).first()
    await expect(receiveRow.getByRole('button', { name: 'Receive' })).toBeVisible()
    await receiveRow.getByRole('button', { name: 'Receive' }).click()
    await expect(page.getByText(/Receive Shipment/i)).toBeVisible()
    await page.getByRole('button', { name: /cancel/i }).click()
    await expect(page.getByText(/Receive Shipment/i)).toBeHidden()
  })

  test('rma: completed status opens promotion modal and cancel keeps status unchanged', async ({ page }) => {
    await loginThroughUi(page)
    await page.goto('/inventory/rma')

    const row = page.locator('tr', { hasText: SMOKE_RMA.orderNumber }).first()
    await expect(row).toBeVisible()
    await row.locator('select').selectOption('Completed')
    await expect(page.getByRole('heading', { name: /Promote To Refurbished Inventory/i })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: /Promote To Refurbished Inventory/i })).toBeHidden()

    const rma = await fetchRmaByOrder(SMOKE_RMA.orderNumber)
    expect(rma.status).toBe('Received')
  })

  test('forecasting: device/component forecasting and purchase orders load', async ({ page }) => {
    await loginThroughUi(page)

    await page.goto('/forecasting/devices')
    await expect(page.getByRole('heading', { name: /Device Forecasting/i })).toBeVisible()
    await expect(page.getByText('AVG VELOCITY')).toBeVisible()
    await expect(page.locator('tbody tr').first()).toBeVisible()
    await expect(page.locator('tbody tr').first().locator('td').nth(2)).toContainText(/\d+\.\d+/)

    await page.goto('/forecasting/component')
    await expect(page.getByRole('heading', { name: /Component Forecasting/i })).toBeVisible()
    await expect(page.locator('tbody tr').first()).toBeVisible()

    await page.goto('/forecasting/purchase-order')
    await expect(page.getByRole('heading', { name: /Purchase Orders/i })).toBeVisible()
    await expect(page.getByText(/PO Number/i)).toBeVisible()
  })

  test('management: page loads with four sections and printer settings', async ({ page }) => {
    await loginThroughUi(page)
    await page.goto('/data')

    await expect(page.getByRole('heading', { name: /AIDA Management/i })).toBeVisible()
    await expect(page.getByText(/^Data$/i)).toBeVisible()
    await expect(page.getByText(/^Barcode Settings$/i)).toBeVisible()
    await expect(page.getByText(/^Maintenance$/i)).toBeVisible()
    await expect(page.getByText(/^Re-run Setup Wizard$/i).first()).toBeVisible()
    await expect(page.getByText('Printer Type')).toBeVisible()
    await expect(page.getByText('Label Size')).toBeVisible()
  })
})