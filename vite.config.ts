import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { pwaOptions } from './pwaOptions';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      VitePWA(pwaOptions(env))
    ],
    define: {
      'process.env': env
    },
    server: {
      port: 8080,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
        '/login': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
        '/register': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
        '/me': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
        '/rubros': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
        '/ask': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
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
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, "index.html"),
          iframe: path.resolve(__dirname, "iframe.html"),
        }
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './tests/setup.ts',
      css: true,
      alias: {
        '@': path.resolve(__dirname, './src'),
        'server': path.resolve(__dirname, './server'),
      }
    }
  };
});
