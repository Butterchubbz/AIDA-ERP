/**
 * WooCommerce HTTP client for PocketBase hooks.
 *
 * Handles paginated requests to the WooCommerce REST API v3
 * using Basic authentication (consumer_key:consumer_secret).
 *
 * Compatible with PocketBase v0.30.0 hook JavaScript runtime.
 * Uses the built-in $http helper for outbound HTTP requests.
 */

/** @param {string} consumerKey
 *  @param {string} consumerSecret
 *  @param {string} storeUrl  Base store URL e.g. "https://myshop.com"
 */
function WooCommerceClient(consumerKey, consumerSecret, storeUrl) {
  this.baseUrl = storeUrl.replace(/\/$/, '') + '/wp-json/wc/v3'
  this.authHeader = 'Basic ' + $encoding.base64Encode(consumerKey + ':' + consumerSecret)
}

/**
 * Fetch all products from WooCommerce (paginated).
 * @param {number} [perPage=100]
 * @returns {Array<Object>}
 */
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

/**
 * Fetch completed orders from WooCommerce (paginated).
 * @param {number} [perPage=100]
 * @returns {Array<Object>}
 */
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

/**
 * Make an authenticated HTTP request to WooCommerce.
 * @param {string} method
 * @param {string} url
 * @returns {Array|Object|null}
 */
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
