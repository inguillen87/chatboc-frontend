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
  // --- ¡INICIO DE LA MEJORA CLAVE! ---
  build: {
    rollupOptions: {
      input: {
        // Tu punto de entrada principal para la aplicación web
        main: path.resolve(__dirname, 'index.html'),
        // Un punto de entrada específico para el iframe
        // Esto le dice a Vite que debe compilar public/iframe.html como una página separada
        iframe: path.resolve(__dirname, 'public/iframe.html'), // <--- ¡Asegúrate de que este archivo exista!
      },
      output: {
        // Opcional: Configuración de nombres de archivo de salida para mayor claridad
        // y para evitar conflictos con los assets de tu app principal si los hubiera.
        // Esto generará los archivos JS/CSS específicos para 'main' y 'iframe'
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/chunk-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`
      }
    }
  },
  // --- ¡FIN DE LA MEJORA CLAVE! ---
});