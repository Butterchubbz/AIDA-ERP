/**
 * PocketBase hook: wizard-driven first-run superuser bootstrap.
 *
 * Lets the AIDA setup wizard create the initial PocketBase superuser when the
 * container was started without PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD env vars
 * (see pocketbase-entrypoint.sh). The AIDA backend is the only intended
 * client of this route. This hook is the authoritative security gate — the
 * route is reachable only while the installation is truly fresh (no
 * superusers and no application users exist yet). As soon as either exists
 * (including a superuser created by the env-credential upsert path in the
 * entrypoint script) it permanently 403s for the lifetime of the data volume.
 *
 * Compatible with PocketBase v0.30.0.
 */

/// <reference path="../pb_data/types.d.ts" />

function aidaBootstrapIsFresh(app) {
  if (app.countRecords('_superusers') > 0) {
    return false
  }

  try {
    if (app.countRecords('users') > 0) {
      return false
    }
  } catch (e) {
    // "users" collection doesn't exist yet on a truly fresh volume — treat as no users.
  }

  return true
}

routerAdd('GET', '/api/aida/bootstrap-superuser', (e) => {
  return e.json(200, { available: aidaBootstrapIsFresh($app) })
})

routerAdd('POST', '/api/aida/bootstrap-superuser', (e) => {
  if (!aidaBootstrapIsFresh($app)) {
    throw new ForbiddenError('Superuser bootstrap is no longer available.')
  }

  var data = new DynamicModel({
    email: '',
    password: '',
  })
  e.bindBody(data)

  var email = ('' + data.email).trim()
  var password = '' + data.password

  if (!email || email.indexOf('@') === -1) {
    throw new BadRequestError('A valid email address is required.')
  }
  if (password.length < 10) {
    throw new BadRequestError('Password must be at least 10 characters long.')
  }

  try {
    $app.runInTransaction((txApp) => {
      // Re-check immediately before writing (inside the transaction) to close
      // the race window between the initial check above and this write.
      if (!aidaBootstrapIsFresh(txApp)) {
        throw new ForbiddenError('Superuser bootstrap is no longer available.')
      }

      var collection = txApp.findCollectionByNameOrId('_superusers')
      var record = new Record(collection)
      record.setEmail(email)
      record.setPassword(password)

      txApp.save(record)
    })
  } catch (err) {
    if (err instanceof ForbiddenError) {
      throw err
    }
    console.error('[bootstrap] Failed to create superuser:', err)
    throw new BadRequestError('Could not create the superuser with the provided credentials.')
  }

  return e.json(200, { status: 'created' })
})
