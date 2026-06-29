// Generates solid-color PWA PNG icons using only built-in Node.js modules.
import { writeFileSync } from 'fs'
import { deflateSync } from 'zlib'

function crc32(buf) {
  let c = 0xFFFFFFFF
  for (const b of buf) { c ^= b; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xEDB88320 : 0) }
  return (c ^ 0xFFFFFFFF) >>> 0
}

function chunk(type, data) {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

function solidPNG(size, r, g, b) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2  // 8-bit RGB

  const row = Buffer.alloc(1 + size * 3)
  for (let x = 0; x < size; x++) { row[1 + x*3] = r; row[2 + x*3] = g; row[3 + x*3] = b }
  const raw = Buffer.concat(Array(size).fill(row))

  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// #0a0a0a
const [r, g, b] = [10, 10, 10]
writeFileSync('public/pwa-192x192.png',    solidPNG(192, r, g, b))
writeFileSync('public/pwa-512x512.png',    solidPNG(512, r, g, b))
writeFileSync('public/apple-touch-icon.png', solidPNG(180, r, g, b))
console.log('PWA icons generated.')
