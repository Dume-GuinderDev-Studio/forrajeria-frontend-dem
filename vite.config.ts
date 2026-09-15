import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  plugins: [
    react(),
    VitePWA({
      // autoUpdate: el SW nuevo hace skipWaiting + clientsClaim y se
      // activa solo en cuanto detecta un deploy nuevo, sin esperar a que
      // el usuario cierre pestañas. La pestaña abierta recibe el bundle
      // nuevo en la siguiente navegación (no fuerza reload a mitad de uso).
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      workbox: {
        // Borra los precaches de versiones viejas al activarse el SW
        // nuevo, en vez de acumularlos en Cache Storage. (Ya es default
        // en vite-plugin-pwa v1, se deja explícito para blindarlo.)
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Forrajería BAS',
        short_name: 'BAS',
        description: 'Gestión de Forrajería y Mascotas',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target:
          process.env.NEXT_PUBLIC_API_URL ||
          process.env.VITE_API_URL ||
          'https://backend-bas.onrender.com/api',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
