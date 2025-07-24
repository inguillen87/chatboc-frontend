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
          rewrite: (path) => path.replace(/^\/api/, '')
        },
        '/tickets': {
            target: 'http://localhost:5000',
            changeOrigin: true,
            secure: false,
        },
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
