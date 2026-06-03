import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';
import { configDefaults } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendTarget = (env.VITE_BACKEND_URL || env.VITE_PROXY_TARGET || 'https://chatbot-backend-2e14.onrender.com').replace(/\/+$/, '');
  const socketTarget = backendTarget.replace(/^http/i, 'ws');

  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    plugins: [
      react(),
      VitePWA({
        // We manually register the service worker in index.html to avoid
        // unintentionally registering it inside the embeddable iframe.
        injectRegister: null,
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'apple-touch-icon.png',
          'masked-icon.svg',
          'favicon/favicon-192x192.png',
          'favicon/favicon-512x512.png',
          'favicon/favicon-maskable-192x192.png',
          'favicon/favicon-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'Chatboc | Plataforma operativa IA',
          short_name: 'Chatboc',
          description: 'Chatboc - IA operativa para gobiernos, colegios y empresas.',
          lang: 'es-AR',
          dir: 'ltr',
          start_url: '/?pwa=1',
          scope: '/',
          display: 'standalone',
          display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
          orientation: 'any',
          background_color: '#ffffff',
          theme_color: '#0f62fe',
          categories: ['business', 'productivity', 'utilities'],
          icons: [
            {
              src: 'favicon/favicon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'favicon/favicon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'favicon/favicon-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: 'favicon/favicon-maskable-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          shortcuts: [
            {
              name: 'Abrir demo',
              short_name: 'Demo',
              description: 'Probar una experiencia demo de Chatboc.',
              url: '/demo?pwa=1',
              icons: [{ src: 'favicon/favicon-192x192.png', sizes: '192x192' }],
            },
            {
              name: 'Panel',
              short_name: 'Panel',
              description: 'Entrar al panel operativo.',
              url: '/login?pwa=1',
              icons: [{ src: 'favicon/favicon-192x192.png', sizes: '192x192' }],
            },
            {
              name: 'Seguimiento',
              short_name: 'Estado',
              description: 'Consultar estado de reclamos o pedidos.',
              url: '/tracking?pwa=1',
              icons: [{ src: 'favicon/favicon-192x192.png', sizes: '192x192' }],
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          globIgnores: [
            '**/assets/vendor-maplibre-*',
            '**/assets/vendor-charts-*',
            '**/assets/vendor-xlsx-*',
            '**/assets/vendor-docx-*',
            '**/assets/vendor-pdf-*',
            '**/assets/vendor-canvas-export-*',
            '**/assets/vendor-compression-*',
            '**/assets/MapLibreMap-*',
            '**/assets/TrackingMap-*',
          ],
          // Precache only the app shell. Heavy vendors stay runtime-loaded by route/tool.
          maximumFileSizeToCacheInBytes: 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api/public/'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'public-api',
                networkTimeoutSeconds: 4,
                cacheableResponse: {
                  statuses: [0, 200, 201, 202, 204],
                },
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 10,
                },
              },
            },
            {
              urlPattern: ({ url }) =>
                url.pathname.startsWith('/api/v2/demo/') ||
                url.pathname.startsWith('/api/pwa/public/') ||
                url.pathname.startsWith('/api/public/tracking/'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'public-demo-api',
                networkTimeoutSeconds: 4,
                cacheableResponse: {
                  statuses: [0, 200, 201, 202, 204],
                },
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 60 * 15,
                },
              },
            },
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api/app/'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'app-api',
                networkTimeoutSeconds: 4,
                cacheableResponse: {
                  statuses: [0, 200, 201, 202, 204],
                },
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 10,
                },
              },
            },
            {
              urlPattern: /^https:\/\/maps\.googleapis\.com\/.*/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'google-maps-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 días
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
          // Removed the rewrite to ensure /api/ prefix is forwarded to the backend
          // rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/ask': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/archivos': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/auth': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/me': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/municipal': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/estadisticas': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: socketTarget,
          ws: true,
          changeOrigin: true,
          secure: false,
        },
        '/api/socket.io': {
          target: socketTarget,
          ws: true,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'server': path.resolve(__dirname, './server'),
      }
    },
    build: {
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, "index.html"),
          iframe: path.resolve(__dirname, "iframe.html"),
          portal: path.resolve(__dirname, "portal/index.html"),
        },
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;

            if (id.includes('react-dom') || id.includes('react/') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('react-router') || id.includes('@remix-run/router')) {
              return 'vendor-router';
            }
            if (id.includes('maplibre-gl')) return 'vendor-maplibre';
            if (id.includes('@react-google-maps/api')) return 'vendor-google-maps';
            if (id.includes('recharts') || id.includes('/d3-') || id.includes('chart.js') || id.includes('react-chartjs-2')) {
              return 'vendor-charts';
            }
            if (id.includes('xlsx')) return 'vendor-xlsx';
            if (id.includes('mammoth')) return 'vendor-docx';
            if (id.includes('jspdf') || id.includes('jspdf-autotable')) return 'vendor-pdf';
            if (id.includes('html2canvas') || id.includes('canvg')) return 'vendor-canvas-export';
            if (id.includes('jszip') || id.includes('fflate') || id.includes('pako')) {
              return 'vendor-compression';
            }
            if (id.includes('@radix-ui') || id.includes('lucide-react') || id.includes('framer-motion')) {
              return 'vendor-ui';
            }

            return;
          },
          // Use content hashes to avoid stale asset mixes (old chunks with new entries)
          // that can trigger runtime errors after deployments or SW updates.
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]'
        }
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './tests/setup.ts',
      exclude: [...configDefaults.exclude, 'tests/**/*.spec.ts'],
      css: false,
      alias: {
        '@': path.resolve(__dirname, './src'),
        'server': path.resolve(__dirname, './server'),
      }
    }
  };
});
