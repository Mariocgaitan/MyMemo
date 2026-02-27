import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Solo activo en producción (HTTPS)
      devOptions: {
        enabled: false
      },

      // ── Workbox config (Safari fix) ──────────────────────────────────────
      workbox: {
        // Safari fix: take control immediately without waiting for tabs to close
        skipWaiting: true,
        clientsClaim: true,

        // Remove old caches after SW updates (avoids stale assets)
        cleanupOutdatedCaches: true,

        // Runtime caching strategies
        runtimeCaching: [
          {
            // API calls → NEVER serve from cache (always fresh)
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // S3 images → StaleWhileRevalidate (fast load + background refresh)
            urlPattern: /^https:\/\/.*\.s3\..*\.amazonaws\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'mymemo-s3-images-v2', // v2 forces mobile PWAs to purge old green markers cache
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 60, // 60 days
              },
            },
          },
          {
            // App shell (HTML, JS, CSS) → NetworkFirst so updates are picked up
            urlPattern: /\.(js|css|html)$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'mymemo-app-shell-v2', // v2 forces clean start
              networkTimeoutSeconds: 5, // Fall back to cache after 5s
            },
          },
        ],
      },

      manifest: {
        name: 'MyMemo - Personal Memory Journal',
        short_name: 'MyMemo',
        description: 'Geo-spatial memory journal with AI-powered face recognition and NLP',
        start_url: '/',
        display: 'standalone',
        background_color: '#1a1a1a',
        theme_color: '#F39C12',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    port: 5174,
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})

