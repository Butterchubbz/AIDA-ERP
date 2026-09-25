import PocketBase from 'pocketbase';
import fs from 'fs';

// This script attempts to create a 'mappingPresets' collection in PocketBase
// with a simple schema if it does not already exist. It's intended as a helper
// for local dev and should be run with pocketbase serve running and the
// appropriate admin token if necessary.

(async function main() {
  const base = process.env.PBC_URL || process.env.PB_URL || 'http://127.0.0.1:8090';
  const pb = new PocketBase(base);

  try {
    const col = await pb.collection('mappingPresets').getOne ? await pb.collection('mappingPresets').getFirstListItem('') : null;
    console.log('Collection exists, skipping creation.');
  } catch (e) {
    console.log('Attempting to create collection mappingPresets via admin API...');
    try {
      // Note: programmatic creation requires admin privileges. This script
      // is intentionally simple: it will POST to the PocketBase /api/collections
      // endpoint if PBC_ADMIN_TOKEN is available in the env.
      const token = process.env.PBC_ADMIN_TOKEN;
      if (!token) {
        console.warn('PBC_ADMIN_TOKEN not set; cannot create collection automatically. Create it manually in PocketBase admin UI.');
        process.exit(0);
      }

      const schema = {
        name: 'mappingPresets',
        type: 'base',
        schema: [
          { name: 'userId', type: 'text', required: true },
          { name: 'collectionId', type: 'text', required: true },
          { name: 'name', type: 'text', required: true },
          { name: 'mapping', type: 'json', required: true },
        ],
      };

      const res = await fetch(`${base}/api/collections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(schema),
      });

      if (!res.ok) {
        console.error('Failed to create collection:', await res.text());
        process.exit(1);
      }
      console.log('Collection created.');
    } catch (err) {
      console.error('Failed to create collection programmatically:', err);
      process.exit(1);
    }
  }
})();
