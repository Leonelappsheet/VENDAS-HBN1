import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const isGasBuild = process.env.BUILD_GAS === 'true';

  return {
    plugins: [
      react(), 
      tailwindcss(),
      ...(isGasBuild ? [
        viteSingleFile(),
        {
          name: 'pwa-mock',
          resolveId(id) {
            if (id === 'virtual:pwa-register') {
              return id;
            }
          },
          load(id) {
            if (id === 'virtual:pwa-register') {
              return 'export function registerSW() { return () => {}; }';
            }
          }
        }
      ] : [
        VitePWA({
          registerType: 'autoUpdate',
          workbox: {
            maximumFileSizeToCacheInBytes: 5000000,
          },
          manifest: {
            name: 'VENDAS HBN1',
            short_name: 'VENDAS HBN1',
            description: 'Sistema de gestão de vendas HBN1',
            theme_color: '#FF6B00',
            background_color: '#ffffff',
            display: 'standalone',
            icons: [
              {
                src: '/logo.svg',
                sizes: '192x192',
                type: 'image/svg+xml',
                purpose: 'any'
              },
              {
                src: '/logo.svg',
                sizes: '512x512',
                type: 'image/svg+xml',
                purpose: 'any'
              },
              {
                src: '/logo.svg',
                sizes: '192x192',
                type: 'image/svg+xml',
                purpose: 'maskable'
              }
            ]
          }
        })
      ])
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: isGasBuild ? {} : {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) {
                return 'firebase-core';
              }
              if (id.includes('xlsx') || id.includes('exceljs')) {
                return 'excel';
              }
              if (id.includes('jspdf') || id.includes('pdfjs-dist')) {
                return 'pdf';
              }
              if (id.includes('recharts') || id.includes('d3')) {
                return 'charts';
              }
              if (id.includes('lucide-react')) {
                return 'icons';
              }
              return 'vendor';
            }
          }
        }
      }
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
