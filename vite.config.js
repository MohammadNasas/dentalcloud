import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // relative asset paths — required so the packaged Electron app loads via file://
  server: {
    host: true, // expose on LAN so the app opens from any device on the same network
    port: 5173,
  },
})
