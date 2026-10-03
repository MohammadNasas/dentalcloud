import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MailCheck, KeyRound, ShieldCheck, ArrowLeft } from 'lucide-react';

const out = new URL('../public/email/', import.meta.url);
await fs.mkdir(out, { recursive: true });
await sharp(fileURLToPath(new URL('../public/logo.png', import.meta.url))).resize(99, 99).png().toFile(fileURLToPath(new URL('logo.png', out)));
for (const [name, Icon, color, size] of [
  ['mail-check', MailCheck, '#0c8178', 23],
  ['key-round', KeyRound, '#0c8178', 23],
  ['shield-check', ShieldCheck, '#86a695', 14],
  ['arrow-left', ArrowLeft, '#ffffff', 16],
]) {
  const svg = renderToStaticMarkup(React.createElement(Icon, { color, size: size * 3, strokeWidth: 1.6 }));
  await fs.writeFile(new URL(`${name}.png`, out), await sharp(Buffer.from(svg)).png().toBuffer());
}
