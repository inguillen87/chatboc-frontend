import { defineConfig } from "vite";
/// <reference types="vitest" />
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8080,
    // Proxy API requests during development to avoid CORS issues
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Target local backend
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