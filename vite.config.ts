import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

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
});