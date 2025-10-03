#!/usr/bin/env node
// Apply owner-only rules for the mappingPresets collection in PocketBase
// Requires PBC_ADMIN_TOKEN in env and optional PBC_URL (defaults to http://127.0.0.1:8090)

import fetch from 'node-fetch';

const BASE = process.env.PBC_URL || process.env.VITE_PB_URL || 'http://127.0.0.1:8090';
const TOKEN = process.env.PBC_ADMIN_TOKEN;
const COLLECTION_NAME = 'mappingPresets';

if (!TOKEN) {
  console.error('PBC_ADMIN_TOKEN environment variable is required.');
  process.exit(1);
}

async function main() {
  try {
    console.log('Fetching collection info...');
    const infoRes = await fetch(`${BASE}/api/collections/${COLLECTION_NAME}`);
    if (!infoRes.ok) {
      console.error('Failed to fetch collection info. Does the collection exist?');
      console.error('Response:', await infoRes.text());
      process.exit(1);
    }
    const info = await infoRes.json();
    const id = info.id || info._id || COLLECTION_NAME;

    console.log('Applying owner-only rules to collection:', id);
    const rulesPayload = {
      listRule: 'userId = @request.auth.id',
      viewRule: 'userId = @request.auth.id',
      createRule: '@request.auth.id != ""',
      updateRule: 'userId = @request.auth.id',
      deleteRule: 'userId = @request.auth.id',
    };

    const res = await fetch(`${BASE}/api/collections/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(rulesPayload),
    });

    if (!res.ok) {
      console.error('Failed to apply rules:', await res.text());
      process.exit(1);
    }

    console.log('Rules applied successfully.');
  } catch (err) {
    console.error('Error applying rules:', err);
    process.exit(1);
  }
}

main();
