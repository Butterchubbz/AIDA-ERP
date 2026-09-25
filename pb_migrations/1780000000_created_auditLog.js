/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    name: 'auditLog',
    type: 'base',
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    indexes: ['CREATE INDEX idx_auditLog_timestamp ON auditLog (timestamp)'],
    fields: [
      { name: 'actor', type: 'text', required: true },
      { name: 'action', type: 'text', required: true },
      { name: 'collection', type: 'text', required: true },
      { name: 'recordId', type: 'text' },
      { name: 'changes', type: 'json' },
      { name: 'ip', type: 'text' },
      { name: 'userAgent', type: 'text' },
      { name: 'timestamp', type: 'autodate', onCreate: true, onUpdate: false },
    ],
  })

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId('auditLog')
  return app.delete(collection)
})