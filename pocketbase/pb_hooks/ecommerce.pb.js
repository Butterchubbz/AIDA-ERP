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
 *
 * WooCommerceClient and transformWCToSalesData are defined directly inside
 * the onRecordCreate handler body because hook handlers execute in an isolated
 * scope and cannot access top-level bindings from *.pb.js files.
 */

/// <reference path="../pb_data/types.d.ts" />

onRecordCreate((e) => {
  /**
   * WooCommerce HTTP client for PocketBase hooks.
   * Handles paginated requests to the WooCommerce REST API v3
   * using Basic authentication (consumer_key:consumer_secret).
   */
  function WooCommerceClient(consumerKey, consumerSecret, storeUrl) {
    this.baseUrl = storeUrl.replace(/\/$/, '') + '/wp-json/wc/v3'
    this.authHeader = 'Basic ' + $encoding.base64Encode(consumerKey + ':' + consumerSecret)
  }

  WooCommerceClient.prototype.getProducts = function (perPage) {
    perPage = perPage || 100
    var allProducts = []
    var page = 1

    while (true) {
      var url = this.baseUrl + '/products?per_page=' + perPage + '&page=' + page + '&status=publish'
      var result = this._request('GET', url)
      if (!result || result.length === 0) break
      allProducts = allProducts.concat(result)
      if (result.length < perPage) break
      page++
    }

    return allProducts
  }

  WooCommerceClient.prototype.getOrders = function (perPage) {
    perPage = perPage || 100
    var allOrders = []
    var page = 1

    while (true) {
      var url = this.baseUrl + '/orders?per_page=' + perPage + '&page=' + page + '&status=completed'
      var result = this._request('GET', url)
      if (!result || result.length === 0) break
      allOrders = allOrders.concat(result)
      if (result.length < perPage) break
      page++
    }

    return allOrders
  }

  WooCommerceClient.prototype._request = function (method, url) {
    try {
      var response = $http.send({
        method: method,
        url: url,
        headers: {
          'Authorization': this.authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 30, // seconds
      })

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error('WooCommerce API error ' + response.statusCode + ': ' + response.body)
      }

      return JSON.parse(response.body)
    } catch (err) {
      throw new Error('[WooCommerceClient] Request failed (' + method + ' ' + url + '): ' + err.message)
    }
  }

  /**
   * Transform WooCommerce products + orders into AIDA salesData records.
   */
  function transformWCToSalesData(wcOrders, userId) {
    var records = []

    for (var i = 0; i < wcOrders.length; i++) {
      var order = wcOrders[i]
      var lineItems = order.line_items || []

      for (var j = 0; j < lineItems.length; j++) {
        var item = lineItems[j]

        // WooCommerce line items carry the product SKU directly
        var sku = item.sku || ''
        if (!sku) {
          // Skip items without a SKU — they can't be matched to AIDA inventory
          continue
        }

        var saleDate = order.date_completed || order.date_created || new Date().toISOString()
        var quantity = parseInt(item.quantity, 10) || 1
        var salePrice = parseFloat(item.price) || 0

        records.push({
          sku: sku,
          quantity: quantity,
          saleDate: saleDate,
          salePrice: salePrice,
          source: 'woocommerce',
          externalOrderId: String(order.id),
          externalLineItemId: String(item.id),
          userId: userId,
        })
      }
    }

    return records
  }

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
