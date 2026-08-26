import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { readFileSync } from 'node:fs';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';
import { configDefaults } from 'vitest/config';

const pwaCoreStaticAssets = [
  'favicon.ico',
  'apple-touch-icon.png',
  'masked-icon.svg',
  'favicon/favicon-192x192.png',
  'favicon/favicon-512x512.png',
  'favicon/favicon-maskable-192x192.png',
  'favicon/favicon-maskable-512x512.png',
  'branding/chatboc-2026/chatboc-agent-launcher-static.svg',
  'chatboc_frontend_pack/branding/chatboc/avatar/chatboc-orbit-avatar.svg',
];

type PwaManifestEntry = {
  revision?: string | null;
  size: number;
  url: string;
};

type ViteManifestChunk = {
  assets?: string[];
  css?: string[];
  file: string;
  imports?: string[];
};

type ViteBuildManifest = Record<string, ViteManifestChunk>;

const normalizePwaAssetUrl = (url: string) => url.replace(/^\/+/, '').split(/[?#]/, 1)[0];

const offlineEntrySources = [
  // The public shell mounts these lazy components on its first render.
  'src/components/chat/ChatWidget.tsx',
  'src/components/chat/ProactiveBubble.tsx',
  // `/encuestas` was part of the production offline smoke. Resolve by source
  // path because Rollup may emit either `encuestas-*` or `index-*` chunks.
  'src/pages/encuestas/index.tsx',
  // Default route of the separately installed portal shell.
  'src/pages/user-portal/UserDashboardPage.tsx',
];

const keepInitialPwaShell = (manifestEntries: PwaManifestEntry[]) => {
  const indexHtml = readFileSync(path.resolve(__dirname, 'dist/index.html'), 'utf8');
  const portalHtml = readFileSync(path.resolve(__dirname, 'dist/portal/index.html'), 'utf8');
  const viteManifest = JSON.parse(
    readFileSync(path.resolve(__dirname, 'dist/.vite/manifest.json'), 'utf8'),
  ) as ViteBuildManifest;
  const manifestUrls = new Set(manifestEntries.map((entry) => normalizePwaAssetUrl(entry.url)));
  // `includeAssets` is appended by vite-plugin-pwa after this transform.
  // Keeping it out of this set prevents duplicate precache entries.
  const shellUrls = new Set<string>(['index.html', 'portal/index.html']);

  for (const html of [indexHtml, portalHtml]) {
    for (const match of html.matchAll(/\b(?:src|href)=["']\/([^"'?#]+)(?:[?#][^"']*)?["']/g)) {
      const assetUrl = normalizePwaAssetUrl(match[1]);
      // The generated root web manifest is appended after Workbox transforms.
      if (assetUrl !== 'manifest.webmanifest') shellUrls.add(assetUrl);
    }
  }

  const visitedViteEntries = new Set<string>();
  const addViteEntry = (entryKey: string) => {
    if (visitedViteEntries.has(entryKey)) return;
    visitedViteEntries.add(entryKey);

    const chunk = viteManifest[entryKey];
    if (!chunk) {
      throw new Error(`PWA shell source missing from Vite manifest: ${entryKey}`);
    }

    for (const assetUrl of [chunk.file, ...(chunk.css ?? []), ...(chunk.assets ?? [])]) {
      const normalizedUrl = normalizePwaAssetUrl(assetUrl);
      if (manifestUrls.has(normalizedUrl)) shellUrls.add(normalizedUrl);
    }

    for (const importedEntry of chunk.imports ?? []) addViteEntry(importedEntry);
  };

  addViteEntry('index.html');
  addViteEntry('portal/index.html');
  for (const source of offlineEntrySources) addViteEntry(source);

  // Registration itself lazy-loads Workbox Window. Keeping this tiny helper
  // cached avoids noisy retry loops during an offline app-shell reload.
  for (const url of manifestUrls) {
    if (/^assets\/workbox-window\..*\.js$/.test(url)) shellUrls.add(url);
  }

  return {
    manifest: manifestEntries.filter((entry) => shellUrls.has(normalizePwaAssetUrl(entry.url))),
    warnings: [],
  };
};

const deferredModulePreloadPatterns = [
  /(^|\/)assets\/vendor-(?:compression|pdf|charts|xlsx|docx|canvas-export|maplibre|google-maps)-/,
  /(^|\/)assets\/widgetCommerce-/,
  /(^|\/)assets\/ChatWidget-/,
  /(^|\/)assets\/TrackingMap-/,
  /(^|\/)assets\/MapLibreMap-/,
];

const shouldDeferModulePreload = (dependencyPath: string) =>
  deferredModulePreloadPatterns.some((pattern) => pattern.test(dependencyPath));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Keep the browser-facing backend URL and the local proxy target independent.
  // This lets local QA use a same-origin `/api` base while explicitly proxying
  // requests to a Preview backend, avoiding both CORS and proxy loops.
  const backendTarget = (env.VITE_PROXY_TARGET || env.VITE_BACKEND_URL || 'https://api.chatboc.ar').replace(/\/+$/, '');
  const socketTarget = backendTarget.replace(/^http/i, 'ws');

  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    plugins: [
      react(),
      VitePWA({
        // We manually register the service worker in index.html to avoid
        // unintentionally registering it inside the embeddable iframe.
        injectRegister: null,
        registerType: 'prompt',
        includeAssets: pwaCoreStaticAssets,
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
          // Keep installation fast and deterministic: cache the generated HTML
          // entry graph plus explicitly supported public offline routes.
          globPatterns: ['**/*.{js,css,html,webmanifest,ico,png,svg}'],
          manifestTransforms: [keepInitialPwaShell],
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [
            /^\/(?:api|ask|archivos|public|socket\.io)(?:\/|$)/,
            /^\/(?:iframe|widget)(?:\/|$)/,
            /^\/widget\.js$/,
            /^\/portal(?:\/|$)/,
            /^\/iframe\.html$/,
          ],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: false,
          importScripts: ['sw-cache-hygiene.js'],
          globIgnores: [
            'logopro.png',
            'chatboc_widget_white_outline.png',
            'logo/chatboc_logo_original.png',
            'images/chatpos*.png',
            'images/chatcrm*.png',
            'chatboc_frontend_pack/branding/chatboc/avatar/chatboc-orbit-reference.png',
          ],
          // Precache only the initial app shell. Route-only vendors stay lazy.
          maximumFileSizeToCacheInBytes: 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) =>
                request.mode === 'navigate' && url.pathname.startsWith('/portal/'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'portal-navigation',
                networkTimeoutSeconds: 3,
                precacheFallback: {
                  fallbackURL: '/portal/index.html',
                },
              },
            },
            {
              // API responses may vary by Authorization, entity token, tenant,
              // anonymous cart or chat-session headers. Cache Storage keys only
              // by URL, so keep all API data network-only to prevent cross-user
              // replay on shared devices.
              urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
              handler: 'NetworkOnly',
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
        '/admin': {
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
      manifest: true,
      modulePreload: {
        resolveDependencies(_url, deps) {
          return deps.filter((dep) => !shouldDeferModulePreload(dep));
        },
      },
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
