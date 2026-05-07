
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

// Resolve repository root reliably across platforms
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const srcDir = path.join(repoRoot, 'inspiration', 'assets');

async function convert() {
  const files = await fs.readdir(srcDir);
  for (const file of files) {
    if (!file.toLowerCase().includes('logo_big')) continue;
    const full = path.join(srcDir, file);
    const base = path.parse(file).name;
    const webpOut = path.join(srcDir, `${base}.webp`);
    const avifOut = path.join(srcDir, `${base}.avif`);
    console.log('Converting', full);
    try {
      await sharp(full).webp({ quality: 80 }).toFile(webpOut);
      await sharp(full).avif({ quality: 50 }).toFile(avifOut);
      console.log('Wrote', webpOut, avifOut);
    } catch (err) {
      console.error('Conversion failed for', full, err);
    }
  }
}

convert().catch(err => {
  console.error(err);
  process.exit(1);
});
