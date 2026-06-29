import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// VITE_API_URL is either an absolute URL (dev: http://localhost:3000)
// or a same-origin path prefix (Docker: /api).
const apiUrl = process.env.VITE_API_URL ?? 'http://localhost:3000'

// Workbox urlPattern function: matches requests destined for the API.
//   - Absolute URL  → match by href prefix  (dev)
//   - Path prefix   → match by pathname prefix  (Docker / prod)
const apiCachePattern = ({ url }: { url: URL }) =>
  apiUrl.startsWith('http')
    ? url.href.startsWith(apiUrl)
    : url.pathname.startsWith(apiUrl)

// Auth endpoints carry tokens / Set-Cookie — never cache them.
const authPattern = (opts: { url: URL }) =>
  apiCachePattern(opts) && opts.url.pathname.includes('/auth/')

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Gonzalo Plata',
        short_name: 'Plata',
        description: 'Personal finance tracker',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            // Must precede the general API rule — Workbox uses the first match.
            urlPattern: authPattern,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: apiCachePattern,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Brand font: cache the Google Fonts stylesheet + font files so the
          // header paints in Lora instantly on cold start (and offline) instead
          // of swapping in from the system fallback.
          {
            urlPattern: ({ url }: { url: URL }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: ({ url }: { url: URL }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
