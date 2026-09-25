/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collections = app.findAllCollections()

  for (const collection of collections) {
    if (collection.system) {
      continue
    }

    collection.listRule = null
    collection.viewRule = null
    collection.createRule = null
    collection.updateRule = null
    collection.deleteRule = null
    app.save(collection)
  }
}, () => {})