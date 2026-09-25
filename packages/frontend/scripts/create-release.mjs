import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outDir = path.join(repoRoot, 'release');

async function ensureDir(d) {
  try {
    await fs.mkdir(d, { recursive: true });
  } catch (e) {}
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch (e) {
    return false;
  }
}

async function run() {
  await ensureDir(outDir);
  const date = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(outDir, `aida-release-${date}.zip`);

  const output = (await import('fs')).createWriteStream(outPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.pipe(output);

  const items = [
    'dist',
    'POCKETBASE_SETUP_GUIDE.md',
    'pocketbase/seed.json',
    '.env.example',
    'README.md',
  ];

  for (const item of items) {
    const full = path.join(repoRoot, item);
    if (await fileExists(full)) {
      const stat = await fs.lstat(full);
      if (stat.isDirectory()) {
        archive.directory(full, item);
      } else {
        archive.file(full, { name: item });
      }
    }
  }

  await archive.finalize();

  await new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('end', resolve);
    archive.on('error', reject);
  });

  console.log('Created release:', outPath);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
