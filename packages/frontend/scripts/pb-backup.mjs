import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

// Simple PocketBase backup script.
// Usage:
//   node ./scripts/pb-backup.mjs --db ./data/pocketbase.db --storage ./storage --out ./backups
// If arguments are omitted, defaults will be used relative to the current working directory.

const args = process.argv.slice(2);
const argMap = {};
for (let i = 0; i < args.length; i += 2) {
  argMap[args[i]] = args[i + 1];
}

const dbPath = argMap['--db'] || process.env.PB_DB_PATH || path.resolve(process.cwd(), 'pocketbase.db');
const storagePath = argMap['--storage'] || process.env.PB_STORAGE_PATH || path.resolve(process.cwd(), 'storage');
const outDir = argMap['--out'] || path.resolve(process.cwd(), 'backups');

if (!fs.existsSync(dbPath)) {
  console.error('PocketBase DB file not found at', dbPath);
  process.exit(1);
}

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outPath = path.join(outDir, `pb-backup-${timestamp}.zip`);

const output = fs.createWriteStream(outPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`Backup complete: ${outPath} (${archive.pointer()} total bytes)`);
});

archive.on('warning', err => {
  if (err.code === 'ENOENT') console.warn(err.message);
  else throw err;
});

archive.on('error', err => {
  throw err;
});

archive.pipe(output);

archive.file(dbPath, { name: path.basename(dbPath) });

if (fs.existsSync(storagePath)) {
  archive.directory(storagePath, 'storage');
} else {
  console.warn('Storage directory not found at', storagePath);
}

await archive.finalize();
