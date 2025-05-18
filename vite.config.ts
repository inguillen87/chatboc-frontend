import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// ✅ NO HAY IMPORTACIONES DE lovable-tagger

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/ask": {
        target: "https://api.chatboc.ar",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [
    react(),
    // componentTagger ya no se usa
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
