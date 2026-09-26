/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  let collection
  try {
    collection = app.findCollectionByNameOrId('pbc_3318608420')
  } catch {
    try {
      collection = app.findCollectionByNameOrId('userPreferences')
    } catch {
      return
    }
  }

  const existingFieldNames = (collection.fields || []).map(f => f.name)
  let changed = false

  if (!existingFieldNames.includes('setupTokenHash')) {
    collection.fields.add(new Field({
      id: 'text_setup_token_hash',
      name: 'setupTokenHash',
      type: 'text',
      max: 0,
    }))
    changed = true
  }

  if (!existingFieldNames.includes('setupCompletedAt')) {
    collection.fields.add(new Field({
      id: 'date_setup_completed_at',
      name: 'setupCompletedAt',
      type: 'date',
    }))
    changed = true
  }

  if (changed) {
    return app.save(collection)
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId('pbc_3318608420')
  collection.fields.removeById('text_setup_token_hash')
  collection.fields.removeById('date_setup_completed_at')
  return app.save(collection)
})