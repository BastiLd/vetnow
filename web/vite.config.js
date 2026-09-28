import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base: GitHub Pages Project Page unter https://bastild.github.io/vetnow/
export default defineConfig({
  base: process.env.VITE_BASE || '/vetnow/',
  // v3: /api → VetNow Hub (Live-Sync + KI). shared/ liegt eine Ebene höher → Zugriff erlauben.
  server: {
    port: 5199,
    host: true,
    fs: { allow: ['..'] },
    proxy: { '/api': { target: process.env.VITE_HUB_URL || 'http://localhost:8787', changeOrigin: true } },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'VetNow Kärnten',
        short_name: 'VetNow',
        description: 'Notfall-Tierarzt-Finder für Kärnten — Praxen mit tagesaktuellem Status.',
        lang: 'de',
        theme_color: '#0c7d72',
        background_color: '#0c7d72',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
