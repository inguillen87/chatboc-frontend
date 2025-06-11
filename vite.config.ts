import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8080,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // --- SECCIÓN AÑADIDA PARA SOLUCIONAR LA ADVERTENCIA ---
  build: {
    rollupOptions: {
      external: [
        // Le decimos a Vite: "No te preocupes por el módulo 'path',
        // sé que es solo para la configuración y no debe ir en el código final."
        'path'
      ]
    }
  }
});