import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: { '/api': 'http://127.0.0.1:8081' },
  },
  preview: {
    // Same policy as nginx.conf, so browser tests exercise the CV reader under it.
    headers: {
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; img-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    },
  },
})
