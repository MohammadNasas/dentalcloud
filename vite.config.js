import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import obfuscator from 'vite-plugin-javascript-obfuscator'

// Heavy obfuscation is reserved for the Electron desktop build (`vite build --mode
// electron`), where startup cost is irrelevant and we want maximum source
// protection in the packaged app.asar.
//
// The WEB build (plain `vite build`, used by Cloudflare) gets a much LIGHTER pass:
// it still renames identifiers and tucks strings into an array, but skips the
// expensive transforms (control-flow flattening, string splitting,
// numbers-to-expressions, base64 string encoding). Those bloat the bundle and slow
// it down a lot — which is exactly what makes weak in-app browsers (Instagram /
// Facebook) and poor mobile networks fail to load the site.
const HEAVY = {
  compact: true,
  identifierNamesGenerator: 'hexadecimal',
  simplify: true,
  numbersToExpressions: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 1,
  stringArrayCallsTransform: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  deadCodeInjection: false,
  selfDefending: false,
  debugProtection: false,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
}
const LIGHT = {
  compact: true,
  identifierNamesGenerator: 'hexadecimal',
  simplify: true,
  numbersToExpressions: false,
  controlFlowFlattening: false,
  stringArray: true,
  stringArrayEncoding: ['none'],
  stringArrayThreshold: 0.75,
  splitStrings: false,
  deadCodeInjection: false,
  selfDefending: false,
  debugProtection: false,
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Obfuscates our own source (everything under src/) in the production build.
    // Scoped to src/ only so third-party libraries (React, etc.) stay untouched and
    // startup stays fast. Dev mode is unaffected (apply:build).
    obfuscator({
      apply: 'build',
      include: ['src/**/*.js', 'src/**/*.jsx'],
      exclude: [/node_modules/],
      options: mode === 'electron' ? HEAVY : LIGHT,
    }),
  ],
  base: './', // relative asset paths — required so the packaged Electron app loads via file://
  server: {
    host: true, // expose on LAN so the app opens from any device on the same network
    port: 5173,
  },
}))
