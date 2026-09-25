/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3318608420")

  // add field
  collection.fields.addAt(9, new Field({
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

  // add field
  collection.fields.addAt(10, new Field({
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

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3318608420")

  // remove field
  collection.fields.removeById("text2970471214")

  // remove field
  collection.fields.removeById("date2278455903")

  return app.save(collection)
})
