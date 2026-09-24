import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves project sites at https://<user>.github.io/<repo>/, so the
  // deploy workflow sets VITE_BASE_PATH="/<repo>/" before building. Locally (npm run
  // dev / npm run build without the env var) it just falls back to "/".
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Расписание университета',
        short_name: 'Расписание',
        description: 'Расписание занятий, которое само обновляется каждый день',
        start_url: '.',
        display: 'standalone',
        background_color: '#faf6f5',
        theme_color: '#b31b17',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell: cache-first (versioned by the build hash, safe to serve instantly).
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // OneSignal's worker lives in its own scope (push/) and must stay a live network
        // file, not a copy frozen in the app's offline cache.
        globIgnores: ['push/**'],
        // Schedule data: try the network first so a fresh daily update is picked up
        // immediately when online, but fall back to the last cached copy offline.
        runtimeCaching: [
          {
            urlPattern: /\/data\/.*\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'schedule-data',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
})
