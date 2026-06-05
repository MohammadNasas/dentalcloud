// Generates build/icon.ico (multi-size) from build/icon.svg.
const fs = require('fs')
const path = require('path')

async function main() {
  const sharp = require('sharp')
  const pngToIco = require('png-to-ico')
  const root = path.join(__dirname, '..')
  const svg = path.join(root, 'build', 'icon.svg')
  const out = path.join(root, 'build', 'icon.ico')
  const pngOut = path.join(root, 'build', 'icon.png')

  const sizes = [256, 128, 64, 48, 32, 24, 16]
  const buffers = []
  for (const s of sizes) {
    const buf = await sharp(svg).resize(s, s).png().toBuffer()
    buffers.push(buf)
  }
  const ico = await pngToIco(buffers)
  fs.writeFileSync(out, ico)
  // 1024px PNG → electron-builder generates the macOS .icns from this.
  await sharp(svg).resize(1024, 1024).png().toFile(pngOut)
  console.log('✓ Wrote', out, `(${(ico.length / 1024).toFixed(1)} KB) + icon.png 1024`)
}

main().catch((e) => { console.error('Icon generation failed:', e.message); process.exit(1) })
