/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1000878319")

  // add field
  collection.fields.addAt(10, new Field({
    "hidden": false,
    "id": "number3709012441",
    "max": null,
    "min": null,
    "name": "onlineStock",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1000878319")

  // remove field
  collection.fields.removeById("number3709012441")

  return app.save(collection)
})
