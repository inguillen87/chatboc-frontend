import { VitePWAOptions } from 'vite-plugin-pwa';

export const pwaOptions = (env: Record<string, string>): Partial<VitePWAOptions> => ({
  registerType: 'autoUpdate',
  injectRegister: 'auto',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}', 'sw.js'],
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-cache',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365
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
            maxAgeSeconds: 60 * 60 * 24 * 365
          },
          cacheableResponse: {
            statuses: [0, 200]
          }
        }
      },
      {
        urlPattern: ({ url }) =>
          url.pathname.startsWith('/api') ||
          url.origin === env.VITE_API_URL,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 1
          },
          cacheableResponse: {
            statuses: [0, 200]
          },
          networkTimeoutSeconds: 10
        }
      },
      {
        urlPattern: ({ url }) => url.pathname.endsWith('iframe.html'),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'iframe-cache',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 1,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
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
        src: "/favicon/favicon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/favicon/favicon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/favicon/favicon-maskable-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/favicon/favicon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  }
});
