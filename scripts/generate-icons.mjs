#!/usr/bin/env node
// One-off generator for the app's PWA icons. Run with `node scripts/generate-icons.mjs`
// whenever the icon design changes; the rasterized PNGs are committed to public/icons/
// so the app doesn't need `sharp` at build/runtime.

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.resolve(process.cwd(), process.env.ICON_OUT_DIR || 'public/icons');
// Override with ICON_COLOR=#rrggbb to recolour the icon (default: the app's indigo).
const BRAND = process.env.ICON_COLOR || '#4338ca';

// Simple calendar glyph on a rounded indigo square. `pad` leaves safe-zone margin for
// maskable icons (Android may crop to a circle).
function svg({ size, pad = 0 }) {
  const inner = size - pad * 2;
  const r = inner * 0.22;
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${BRAND}"/>
  <g transform="translate(${pad}, ${pad})">
    <rect x="${inner * 0.14}" y="${inner * 0.18}" width="${inner * 0.72}" height="${inner * 0.66}"
          rx="${r * 0.35}" fill="#ffffff"/>
    <rect x="${inner * 0.14}" y="${inner * 0.18}" width="${inner * 0.72}" height="${inner * 0.16}"
          rx="${r * 0.35}" fill="${BRAND}"/>
    <rect x="${inner * 0.14}" y="${inner * 0.18}" width="${inner * 0.72}" height="${inner * 0.16}"
          fill="${BRAND}"/>
    <rect x="${inner * 0.26}" y="${inner * 0.10}" width="${inner * 0.07}" height="${inner * 0.16}"
          rx="${inner * 0.03}" fill="#ffffff"/>
    <rect x="${inner * 0.67}" y="${inner * 0.10}" width="${inner * 0.07}" height="${inner * 0.16}"
          rx="${inner * 0.03}" fill="#ffffff"/>
    <g fill="${BRAND}">
      <rect x="${inner * 0.24}" y="${inner * 0.44}" width="${inner * 0.13}" height="${inner * 0.13}" rx="${inner * 0.02}"/>
      <rect x="${inner * 0.435}" y="${inner * 0.44}" width="${inner * 0.13}" height="${inner * 0.13}" rx="${inner * 0.02}"/>
      <rect x="${inner * 0.63}" y="${inner * 0.44}" width="${inner * 0.13}" height="${inner * 0.13}" rx="${inner * 0.02}"/>
      <rect x="${inner * 0.24}" y="${inner * 0.63}" width="${inner * 0.13}" height="${inner * 0.13}" rx="${inner * 0.02}"/>
      <rect x="${inner * 0.435}" y="${inner * 0.63}" width="${inner * 0.13}" height="${inner * 0.13}" rx="${inner * 0.02}"/>
    </g>
  </g>
</svg>`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const targets = [
    { file: 'icon-192.png', size: 192, pad: 0 },
    { file: 'icon-512.png', size: 512, pad: 0 },
    { file: 'maskable-512.png', size: 512, pad: 512 * 0.1 },
    { file: 'apple-touch-icon.png', size: 180, pad: 0 },
  ];

  for (const t of targets) {
    const buf = await sharp(Buffer.from(svg(t))).png().toBuffer();
    await writeFile(path.join(OUT_DIR, t.file), buf);
    console.log(`wrote ${t.file}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
