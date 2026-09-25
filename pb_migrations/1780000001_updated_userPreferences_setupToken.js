/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId('pbc_3318608420')

  collection.fields.add(new Field({
    id: 'text_setup_token_hash',
    name: 'setupTokenHash',
    type: 'text',
    max: 0,
  }))
  collection.fields.add(new Field({
    id: 'date_setup_completed_at',
    name: 'setupCompletedAt',
    type: 'date',
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId('pbc_3318608420')
  collection.fields.removeById('text_setup_token_hash')
  collection.fields.removeById('date_setup_completed_at')
  return app.save(collection)
})