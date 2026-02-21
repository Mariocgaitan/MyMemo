import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Solo activo en producción (HTTPS); desactivado en dev para evitar cache issues
      devOptions: {
        enabled: false
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
    port: 5174, // Changed from 5173 to avoid HTTPS cache
    host: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
