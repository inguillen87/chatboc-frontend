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
        target: 'https://api.chatboc.ar',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // No es necesario marcar "path" como externo ya que solo se
  // utiliza en la configuración y no en el bundle final.
});