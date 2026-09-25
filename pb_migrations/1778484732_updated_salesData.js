/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  let collection
  try {
    collection = app.findCollectionByNameOrId("pbc_3516206117")
  } catch {
    return
  }

  // add field
  collection.fields.addAt(7, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1865448975",
    "max": 0,
    "min": 0,
    "name": "saleDate",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "number2683508278",
    "max": null,
    "min": null,
    "name": "quantity",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(9, new Field({
    "hidden": false,
    "id": "number3932293411",
    "max": null,
    "min": null,
    "name": "salePrice",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(10, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1602912115",
    "max": 0,
    "min": 0,
    "name": "source",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(11, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1689669068",
    "max": 0,
    "min": 0,
    "name": "userId",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  let collection
  try {
    collection = app.findCollectionByNameOrId("pbc_3516206117")
  } catch {
    return
  }

  // remove field
  collection.fields.removeById("text1865448975")

  // remove field
  collection.fields.removeById("number2683508278")

  // remove field
  collection.fields.removeById("number3932293411")

  // remove field
  collection.fields.removeById("text1602912115")

  // remove field
  collection.fields.removeById("text1689669068")

  return app.save(collection)
})
