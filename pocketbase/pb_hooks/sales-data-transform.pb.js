/**
 * Transform WooCommerce products + orders into AIDA salesData records.
 *
 * Mapping strategy:
 *   - Each WooCommerce order line item becomes one salesData record.
 *   - WC product.sku is used directly as the AIDA sku field.
 *   - Line items without a resolvable SKU are skipped (logged as warnings).
 *
 * Compatible with PocketBase v0.30.0 hook JavaScript runtime.
 *
 * @param {Array<Object>} wcOrders    Completed WooCommerce orders
 * @param {string}        userId      AIDA user id who initiated the sync
 * @returns {Array<Object>}           salesData records ready for PB create()
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
