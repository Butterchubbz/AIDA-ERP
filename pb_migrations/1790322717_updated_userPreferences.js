/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  let collection
  try {
    collection = app.findCollectionByNameOrId("pbc_3318608420")
  } catch {
    try {
      collection = app.findCollectionByNameOrId("userPreferences")
    } catch {
      return
    }
  }

  let hasEmail = false
  let hasLogin = false
  try {
    if (collection.fields.getByName("setupOwnerEmail")) {
      hasEmail = true
    }
  } catch {}
  try {
    if (collection.fields.getByName("setupOwnerLastLoginAt")) {
      hasLogin = true
    }
  } catch {}

  let changed = false

  if (!hasEmail) {
    collection.fields.addAt(collection.fields.length, new Field({
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text2970471214",
      "max": 0,
      "min": 0,
      "name": "setupOwnerEmail",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    }))
    changed = true
  }

  if (!hasLogin) {
    collection.fields.addAt(collection.fields.length, new Field({
      "hidden": false,
      "id": "date2278455903",
      "max": "",
      "min": "",
      "name": "setupOwnerLastLoginAt",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "date"
    }))
    changed = true
  }

  if (changed) {
    return app.save(collection)
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3318608420")

  // remove field
  collection.fields.removeById("text2970471214")

  // remove field
  collection.fields.removeById("date2278455903")

  return app.save(collection)
})
