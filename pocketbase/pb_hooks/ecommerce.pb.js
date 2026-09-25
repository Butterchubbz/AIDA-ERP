/**
 * PocketBase hook: WooCommerce e-commerce sync.
 *
 * Triggered when a record is created in the `ecommerceSyncLog` collection.
 * The backend route (POST /api/ecommerce/sync) creates this record with
 * `decryptedKeyTemp` and `storeUrl` in the record data — this hook
 * reads those fields, performs the WooCommerce sync, then clears the
 * temporary plaintext key from the record before it is persisted.
 *
 * Compatible with PocketBase v0.30.0 (uses the v0.23+ onRecordCreate model
 * hook and $app.save(), not the removed onRecordBeforeCreateRequest/$app.dao()).
 *
 * Security note: `decryptedKeyTemp` is NEVER written to the database.
 * It is consumed here and stripped from the record before creation completes.
 */

/// <reference path="../pb_data/types.d.ts" />

onRecordCreate((e) => {
  var record = e.record

  var decryptedKey = record.get('decryptedKeyTemp')
  var storeUrl = record.get('storeUrl')
  var userId = record.get('userId')

  // Always clear the temporary key — even if the sync fails, it must not persist
  record.set('decryptedKeyTemp', '')

  if (!decryptedKey || !storeUrl) {
    record.set('status', 'error')
    record.set('errorMessage', 'Missing decryptedKeyTemp or storeUrl in sync request')
    record.set('recordsImported', 0)
    return e.next()
  }

  // Parse "consumer_key:consumer_secret" format
  var colonIdx = decryptedKey.indexOf(':')
  if (colonIdx === -1) {
    record.set('status', 'error')
    record.set('errorMessage', 'Invalid credential format — expected "consumer_key:consumer_secret"')
    record.set('recordsImported', 0)
    return e.next()
  }

  var consumerKey = decryptedKey.slice(0, colonIdx)
  var consumerSecret = decryptedKey.slice(colonIdx + 1)

  try {
    var client = new WooCommerceClient(consumerKey, consumerSecret, storeUrl)

    // Fetch orders (products are resolved via line item SKUs directly)
    var orders = client.getOrders(100)
    var salesRecords = transformWCToSalesData(orders, userId)

    var salesCollection = $app.findCollectionByNameOrId('salesData')
    var imported = 0
    for (var i = 0; i < salesRecords.length; i++) {
      try {
        var salesRecord = new Record(salesCollection)
        salesRecord.load(salesRecords[i])
        $app.save(salesRecord)
        imported++
      } catch (rowErr) {
        // Log per-row errors but continue importing remaining records
        console.error('[ecommerce hook] Failed to save salesData row:', rowErr)
      }
    }

    record.set('status', 'success')
    record.set('recordsImported', imported)
    record.set('errorMessage', '')
  } catch (err) {
    console.error('[ecommerce hook] Sync failed:', err)
    record.set('status', 'error')
    record.set('recordsImported', 0)
    record.set('errorMessage', err.message || 'Unknown error during WooCommerce sync')
  }

  return e.next()
}, 'ecommerceSyncLog')

