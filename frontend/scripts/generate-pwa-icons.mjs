/**
 * Generates PWA icons from frontend/logo.png into public/icons/.
 * Run: npm run generate:pwa-icons
 *
 * Maskable variants use extra padding (~62% safe zone) on brand background #F7F4F0.
 * If logo.png is low-resolution, replace with a higher-res asset for crisp 512px output.
 */
import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const logoPath = path.join(root, 'logo.png');
const outDir = path.join(root, 'public', 'icons');

const BG = '#F7F4F0';

async function squareIcon(size, innerRatio, filename) {
  const inner = Math.round(size * innerRatio);
  const logoBuf = await sharp(logoPath)
    .resize(inner, inner, { fit: 'inside', background: BG })
    .flatten({ background: BG })
    .png()
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logoBuf, gravity: 'center' }])
    .png()
    .toFile(path.join(outDir, filename));
}

await mkdir(outDir, { recursive: true });

await squareIcon(192, 0.82, 'icon-192.png');
await squareIcon(512, 0.82, 'icon-512.png');
await squareIcon(180, 0.82, 'icon-180.png');
await squareIcon(192, 0.62, 'icon-maskable-192.png');
await squareIcon(512, 0.62, 'icon-maskable-512.png');

console.log('PWA icons written to public/icons/');
