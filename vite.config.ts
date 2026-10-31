import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const isGasBuild = process.env.BUILD_GAS === 'true';

  let buildTimestamp = Date.now();
  const APP_VERSION = '2.5.1';
  try {
    const existingVersionPath = path.resolve(__dirname, 'public/version.json');
    if (fs.existsSync(existingVersionPath)) {
      const existing = JSON.parse(fs.readFileSync(existingVersionPath, 'utf8'));
      if (existing.buildTime && mode === 'development') {
        buildTimestamp = existing.buildTime;
      }
    }
  } catch (_) {}

  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'generate-version-json',
        buildStart() {
          try {
            const v = {
              version: APP_VERSION,
              buildTime: buildTimestamp,
              builtAt: new Date(buildTimestamp).toISOString()
            };
            fs.writeFileSync(path.resolve(__dirname, 'public/version.json'), JSON.stringify(v, null, 2));
            const distDir = path.resolve(__dirname, 'dist');
            if (fs.existsSync(distDir)) {
              fs.writeFileSync(path.resolve(distDir, 'version.json'), JSON.stringify(v, null, 2));
            }
          } catch (_) {}
        }
      },
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
            maximumFileSizeToCacheInBytes: 6000000,
            cleanupOutdatedCaches: true,
            navigateFallbackDenylist: [/^\/api/, /^\/version\.json/],
            runtimeCaching: [
              {
                urlPattern: ({ url }) => url.pathname.startsWith('/api') || url.pathname.endsWith('/version.json'),
                handler: 'NetworkOnly'
              }
            ]
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
      '__APP_BUILD_TIME__': JSON.stringify(buildTimestamp),
      '__APP_VERSION__': JSON.stringify(APP_VERSION),
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
