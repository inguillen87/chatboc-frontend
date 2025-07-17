import { defineConfig } from "vite";
/// <reference types="vitest" />
import react from "@vitejs/plugin-react-swc";
import path from "path";
// import { defineConfig } from 'vite'; // Ya está importado arriba
import { VitePWA } from 'vite-plugin-pwa'; // AÑADIDO: Importar VitePWA

export default defineConfig({
  plugins: [
    react(),
    VitePWA({ // AÑADIDO: Configuración de VitePWA
      registerType: 'autoUpdate', // Actualiza el SW automáticamente cuando hay una nueva versión
      injectRegister: 'auto', // Inyecta el script de registro del SW automáticamente
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'], // Archivos a precachear
        runtimeCaching: [ // Estrategias de caching en runtime
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
            // Cache para las llamadas a tu API (ej. /api/ o el VITE_API_URL)
            // Ajusta urlPattern según tu endpoint de API
            urlPattern: ({ url }) => url.pathname.startsWith('/api') || url.origin === import.meta.env.VITE_API_URL,
            handler: 'NetworkFirst', // Intenta la red primero, luego cache si offline
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 1 // 1 día
              },
              cacheableResponse: {
                statuses: [0, 200] // Cachea respuestas exitosas
              },
              networkTimeoutSeconds: 10 // Timeout para la red antes de recurrir al cache
            }
          }
        ]
      },
      manifest: { // Re-declarar el manifest aquí asegura que vite-plugin-pwa lo procese
        name: "Chatboc - IA para Gobiernos y Empresas",
        short_name: "Chatboc",
        description: "Plataforma IA con CRM y Chatbots para optimizar la comunicación y gestión en municipios y empresas.",
        theme_color: "#007AFF",
        background_color: "#FFFFFF",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/",
        lang: "es-AR",
        icons: [ // Es bueno tenerlos aquí también, el plugin puede optimizarlos
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
            "src": "/favicon/favicon-maskable-192x192.png", // Asegúrate que estos existan o usa los normales
            "sizes": "192x192",
            "type": "image/png",
            "purpose": "maskable"
          },
          {
            "src": "/favicon/favicon-maskable-512x512.png", // Asegúrate que estos existan o usa los normales
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
    // Proxy API requests during development to avoid CORS issues
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // Target local backend
        changeOrigin: true,
        secure: false, // Local backend is likely HTTP
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // Si tienes un servidor de socket.io separado o en el mismo backend pero diferente path/puerto para WS
      // '/socket.io': {
      //   target: 'ws://localhost:3000', // Asegúrate que coincida con tu backend de socket.io
      //   ws: true,
      //   changeOrigin: true,
      // },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        iframe: path.resolve(__dirname, "iframe.html"),
      },
    },
  },
  // No es necesario marcar "path" como externo ya que solo se
  // utiliza en la configuración y no en el bundle final.
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    css: true,
  },
});