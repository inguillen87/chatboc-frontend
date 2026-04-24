import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';
import { configDefaults } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

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
        ],
        manifest: {
          name: 'Chatboc',
          short_name: 'Chatboc',
          description: 'Chatboc - IA para Gobiernos y Empresas',
          start_url: '/?pwa=1',
          scope: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#0f62fe',
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
              src: 'favicon/favicon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          // Allow larger chunks like MapLibre (~3MB) to be precached
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
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
          target: 'https://chatbot-backend-2e14.onrender.com',
          changeOrigin: true,
          secure: false,
          // Removed the rewrite to ensure /api/ prefix is forwarded to the backend
          // rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/socket.io': {
          target: 'wss://chatbot-backend-2e14.onrender.com',
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

            if (id.includes('maplibre-gl')) return 'vendor-maplibre';
            if (id.includes('recharts') || id.includes('/d3-')) return 'vendor-charts';
            if (id.includes('html2canvas')) return 'vendor-html2canvas';

            const packagePath = id.split('node_modules/')[1];
            if (!packagePath) return 'vendor-misc';

            const [rawName, maybeScopePackage] = packagePath.split('/');
            const packageName = rawName.startsWith('@') && maybeScopePackage
              ? `${rawName}/${maybeScopePackage}`
              : rawName;
            const safePackageName = packageName.replace('@', '').replace('/', '-');
            return `vendor-${safePackageName}`;
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
