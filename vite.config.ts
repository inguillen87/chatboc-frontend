import { defineConfig, loadEnv } from "vite";
/// <reference types="vitest" />
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}', 'sw.js'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 año
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 año
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              // Cache para las llamadas a tu API
              urlPattern: ({ url }) =>
                url.pathname.startsWith('/api') ||
                url.origin === env.VITE_API_URL,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 1 // 1 día
                },
                cacheableResponse: {
                  statuses: [0, 200]
                },
                networkTimeoutSeconds: 10
              }
            }
          ]
        },
        manifest: {
          name: "Chatboc - IA para Gobiernos y Empresas",
          short_name: "Chatboc",
          description: "Plataforma IA con CRM y Chatbots para optimizar la comunicación y gestión en municipios y empresas.",
          theme_color: "#007AFF",
          background_color: "#FFFFFF",
          display: "standalone",
          orientation: "portrait-primary",
          start_url: "/",
          lang: "es-AR",
          icons: [
            {
              "src": "/favicon/favicon-192x192.png",
              "sizes": "192x192",
              "type": "image/png",
              "purpose": "any"
            },
            {
              "src": "/favicon/favicon-512x512.png",
              "sizes": "512x512",
              "type": "image/png",
              "purpose": "any"
            },
            {
              "src": "/favicon/favicon-maskable-192x192.png",
              "sizes": "192x192",
              "type": "image/png",
              "purpose": "maskable"
            },
            {
              "src": "/favicon/favicon-maskable-512x512.png",
              "sizes": "512x512",
              "type": "image/png",
              "purpose": "maskable"
            }
          ]
        }
      })
    ],
    server: {
      port: 8080,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
        // Si tenés endpoints directos sin prefijo /api, agregalos abajo:
        '/login': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
        '/register': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
        '/me': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
        '/rubros': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
        '/ask': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
        // Agregá otros endpoints backend si los usás directamente desde el frontend
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "server": path.resolve(__dirname, "./server"),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, "index.html"),
          iframe: path.resolve(__dirname, "src/iframe.tsx"),
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './tests/setup.ts',
      css: true,
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "server": path.resolve(__dirname, "./server"),
      }
    },
  }
});
