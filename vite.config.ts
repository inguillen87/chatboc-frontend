import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// import { componentTagger } from "lovable-tagger"; ❌ lo comentamos

// ✅ dummy para que no explote el build en producción
const componentTagger = () => null;

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/ask": {
        target: "https://api.chatboc.ar",
        changeOrigin: true,
        secure: false, // ⚠️ dejalo en false si estás probando sin SSL válido
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(), // solo aplica si estás local
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
