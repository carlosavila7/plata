// Copies the committed source icons into the PWA icon slots Vite/vite-plugin-pwa expect.
import { copyFileSync } from 'fs'

copyFileSync('icon-source/favicon.png', 'public/favicon.png')
copyFileSync('icon-source/favicon-512.png', 'public/pwa-512x512.png')
copyFileSync('icon-source/favicon-512.png', 'public/pwa-192x192.png')
copyFileSync('icon-source/favicon-512.png', 'public/apple-touch-icon.png')
console.log('PWA icons copied.')
